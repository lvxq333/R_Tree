import axios from 'axios';
export const axiosForBackend = axios.create({ timeout: 15000 });
export const logger = console;
