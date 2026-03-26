import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld(
    'electron', {
    windowControls: {
        minimize: () => ipcRenderer.send('window-minimize'),
        maximize: () => ipcRenderer.send('window-maximize'),
        close: () => ipcRenderer.send('window-close'),
        getIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
        zoomIn: () => ipcRenderer.send('window-zoom-in'),
        zoomOut: () => ipcRenderer.send('window-zoom-out'),
        zoomReset: () => ipcRenderer.send('window-zoom-reset'),
        onMaximizedChange: (callback) => {
            if (typeof callback !== 'function') return () => {};
            const listener = (_event, value) => callback(Boolean(value));
            ipcRenderer.on('window-maximized-change', listener);
            return () => ipcRenderer.removeListener('window-maximized-change', listener);
        },
        setAlwaysOnTop: (flag) => ipcRenderer.send('window-always-on-top', !!flag),
    },
    mail: {
        send: (payload) => ipcRenderer.invoke('mail-send', payload),
        authStart: (config) => ipcRenderer.invoke('mail-auth-start', config),
    },
    desktopAppearance: {
        saveWallpaper: (payload) => ipcRenderer.invoke('desktop-wallpaper-save', payload),
    },
    documents: {
        printPdfBase64: (payload) => ipcRenderer.invoke('document-print-pdf', payload),
    },
    pdf: {
        resolveSovereignUrl: (localFilePath) => ipcRenderer.invoke('acis-pdf-resolve', { localFilePath }),
        onPdfDetected: (callback) => {
            const listener = (_event, data) => callback(data);
            ipcRenderer.on('sync-event', listener);
            return () => ipcRenderer.removeListener('sync-event', listener);
        },
        startScraping: (payload) => ipcRenderer.invoke('start-scraping', payload),
    },
    satellite: {
        copy: (payload) => ipcRenderer.send('satellite-copy-action', payload),
        track: (payload) => ipcRenderer.send('satellite-track-action', payload),
        onSyncEvent: (callback) => ipcRenderer.on('sync-event', (event, data) => callback(data)),
    },
    onSyncEvent: (callback) => ipcRenderer.on('sync-event', (event, data) => callback(data))
}
);
