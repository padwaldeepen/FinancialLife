import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || undefined

const api = axios.create({
  baseURL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export default api
