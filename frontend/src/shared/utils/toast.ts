import { useBoundStore } from '../../store/useBoundStore.ts'

// Same call shape as the react-hot-toast API it replaces (toast.success(msg) /
// toast.error(msg)) so every existing call site needed only an import-path change,
// not a rewrite. Plain functions, not a hook — callable from outside components
// (catch blocks, store actions), same pattern shared/api/interceptors.ts uses to
// reach the store from outside React.
const toast = {
  success: (message: string) => useBoundStore.getState().pushToast(message, 'success'),
  error: (message: string) => useBoundStore.getState().pushToast(message, 'error'),
}

export default toast
