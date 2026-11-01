import { contextBridge, ipcRenderer } from 'electron';
import { appInfoSchema, type DesktopApi } from '../shared/desktop';

const desktop: DesktopApi = {
  getAppInfo: async () =>
    appInfoSchema.parse(await ipcRenderer.invoke('app:get-info')),
};

contextBridge.exposeInMainWorld('desktop', desktop);
