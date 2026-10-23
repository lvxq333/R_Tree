import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class DeepSeekService {
  configuration() {
    if (process.env.ASSESSMENT_MODE !== 'real') return { model:'mock-assessment-v1', key:null, url:null };
    const { AI_API_KEY:key, AI_BASE_URL:base, AI_MODEL:model } = process.env;
    if (!key || !base || !model) throw new ServiceUnavailableException('服务端模型配置不完整');
    let url: URL;
    try { url = new URL(`${base.replace(/\/$/, '')}/chat/completions`); }
    catch { throw new ServiceUnavailableException('模型地址配置无效'); }
    if (url.protocol !== 'https:' || url.hostname !== 'api.deepseek.com' || url.username || url.password || url.search || url.hash) {
      throw new ServiceUnavailableException('当前适配器仅支持已确认的 DeepSeek 官方 HTTPS 接口');
    }
    return { key, url, model };
  }
  async complete(system: string, input: unknown): Promise<unknown> {
    const { key, url, model } = this.configuration();
    if (model === 'mock-assessment-v1') {
      const request=input as {standard?:{abilities?:{id:string}[]}};
      return { abilities:(request.standard?.abilities ?? []).map(ability=>({ abilityId:ability.id,
        supportedLevel:null,reason:'模拟评估：尚未调用真实模型，不能依据此结果认定能力等级。',
        citations:[],gaps:['等待真实模型评估与人工复核'],questions:['请补充可核验的工作材料和实际成果。'] })) };
    }
    if (!key || !url) throw new ServiceUnavailableException('模型配置不完整');
    try {
      const response = await fetch(url, {
        method:'POST', redirect:'error', signal:AbortSignal.timeout(90_000),
        headers:{ Authorization:`Bearer ${key}`, 'Content-Type':'application/json' },
        body:JSON.stringify({ model, messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(input)}],
          response_format:{type:'json_object'}, thinking:{type:'disabled'}, max_tokens:5000, stream:false }),
      });
      if (!response.ok) {
        const message = response.status === 401 ? '模型鉴权失败，请检查服务端密钥' : response.status === 402 ? '模型账户余额不足'
          : response.status === 429 ? '模型请求频率受限，请稍后重试' : `模型服务调用失败（HTTP ${response.status}）`;
        throw new BadGatewayException(message);
      }
      const text = await response.text();
      if (text.length > 500_000) throw new BadGatewayException('模型响应过大，请减少所选材料');
      const data = JSON.parse(text);
      if (data?.choices?.[0]?.finish_reason !== 'stop') throw new BadGatewayException('模型响应未完整结束，请重试');
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new BadGatewayException('模型未返回评估内容');
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof Error && ['TimeoutError','AbortError'].includes(error.name)) throw new BadGatewayException('模型请求超时，请重试');
      throw new BadGatewayException('模型连接或响应解析失败，请重试');
    }
  }
}
