/* global process */
import { createRequire } from 'module';
import { dirname, extname, isAbsolute, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import nodemailer from 'nodemailer';

const require = createRequire(import.meta.url);
const { app, BrowserWindow, clipboard, ipcMain, protocol, shell } = require('electron');
import { OAuth2Client } from 'google-auth-library';
import http from 'http';
import { parse, pathToFileURL } from 'url';
import { mkdirSync, readdirSync, unlinkSync } from 'fs';
import { Buffer } from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;
const STATE_PATH = join(app.getPath('userData'), 'window-state.json');
const SATELLITE_STATE_PATH = join(app.getPath('userData'), 'satellite-state.json');
const SATELLITE_ROUTE = '#/satellite';
const getSatelliteUrl = () => {
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
        return `${process.env.VITE_DEV_SERVER_URL}${SATELLITE_ROUTE}`;
    }
    return `${pathToFileURL(join(__dirname, '../dist/index.html')).toString()}${SATELLITE_ROUTE}`;
};
const WALLPAPER_DIR = join(app.getPath('userData'), 'desktop-wallpapers');
const APP_WINDOW_ICON = join(__dirname, isDev ? '../public/appIcon.ico' : '../dist/appIcon.ico');

if (isDev) {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'acis-pdf',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            stream: true,
            corsEnabled: false,
        },
    },
]);

let mainWindow;
let satelliteWindow;
let satelliteState = { x: undefined, y: undefined };
let robotjs;

try {
    robotjs = require('robotjs');
} catch {
    robotjs = null;
}

const isSafePdfPath = (filePath) => {
    if (!filePath) return false;
    const candidate = normalize(String(filePath));
    if (!isAbsolute(candidate)) return false;
    if (extname(candidate).toLowerCase() !== '.pdf') return false;
    return existsSync(candidate);
};

const encodePdfPathToken = (filePath) => Buffer.from(String(filePath), 'utf8').toString('base64url');
const decodePdfPathToken = (token) => Buffer.from(String(token || ''), 'base64url').toString('utf8');

const setupSovereignPdfViewer = () => {
    protocol.registerFileProtocol('acis-pdf', (request, callback) => {
        try {
            const url = new URL(request.url);
            if (url.hostname !== 'local') return callback({ error: -6 });

            const token = decodeURIComponent(url.pathname.replace(/^\//, ''));
            const decodedPath = decodePdfPathToken(token);

            if (!isSafePdfPath(decodedPath)) return callback({ error: -6 });
            callback({ path: decodedPath });
        } catch (error) {
            console.error('[acis-pdf] Protocol error:', error);
            callback({ error: -2 });
        }
    });

    ipcMain.removeHandler('acis-pdf-resolve');
    ipcMain.handle('acis-pdf-resolve', async (_event, { localFilePath }) => {
        try {
            const candidate = normalize(String(localFilePath || ''));
            if (!isSafePdfPath(candidate)) {
                return { ok: false, error: 'Invalid PDF path. Provide an absolute local .pdf file path.' };
            }

            const token = encodePdfPathToken(candidate);
            const url = `acis-pdf://local/${token}#toolbar=0&navpanes=0`;
            return { ok: true, url, fileName: candidate.split(/[/\\\\]/).pop() };
        } catch (error) {
            return { ok: false, error: String(error?.message || 'Failed to resolve PDF URL.') };
        }
    });
};

function getSavedState() {
    try {
        if (existsSync(STATE_PATH)) {
            return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
        }
    } catch (e) {
        console.error('Failed to read window state', e);
    }
    return { width: 1400, height: 900, x: undefined, y: undefined, isMaximized: false };
}

function saveState() {
    if (!mainWindow) return;
    try {
        const bounds = mainWindow.getBounds();
        const state = {
            ...bounds,
            isMaximized: mainWindow.isMaximized()
        };
        writeFileSync(STATE_PATH, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save window state', e);
    }
}

function loadSatelliteWindowState() {
    try {
        if (existsSync(SATELLITE_STATE_PATH)) {
            const parsed = JSON.parse(readFileSync(SATELLITE_STATE_PATH, 'utf-8'));
            return {
                x: Number.isFinite(parsed?.x) ? parsed.x : undefined,
                y: Number.isFinite(parsed?.y) ? parsed.y : undefined,
            };
        }
    } catch (error) {
        console.error('Unable to read satellite window state', error);
    }
    return { x: undefined, y: undefined };
}

function persistSatelliteWindowState() {
    if (!satelliteWindow || satelliteWindow.isDestroyed()) return;
    try {
        const { x, y } = satelliteWindow.getBounds();
        satelliteState = { x, y };
        writeFileSync(SATELLITE_STATE_PATH, JSON.stringify(satelliteState));
    } catch (error) {
        console.error('Failed to persist satellite window state', error);
    }
}

satelliteState = loadSatelliteWindowState();

function createSatelliteWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (satelliteWindow && !satelliteWindow.isDestroyed()) {
        if (satelliteWindow.getParentWindow() !== mainWindow) {
            satelliteWindow.setParentWindow(mainWindow);
        }
        return satelliteWindow;
    }

    const { x, y } = satelliteState;
    satelliteWindow = new BrowserWindow({
        parent: mainWindow,
        width: 360,
        height: 360,
        x,
        y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: true,
        vibrancy: process.platform === 'win32' ? 'mica' : undefined,
        visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
        backgroundColor: '#00000000',
        show: false,
        webPreferences: {
            sandbox: true,
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    satelliteWindow.setMenuBarVisibility(false);
    satelliteWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    satelliteWindow.setAlwaysOnTop(true, 'screen-saver');
    satelliteWindow.on('move', persistSatelliteWindowState);
    satelliteWindow.on('resize', persistSatelliteWindowState);
    satelliteWindow.on('closed', () => {
        persistSatelliteWindowState();
        satelliteWindow = null;
    });
    satelliteWindow.once('ready-to-show', () => {
        if (satelliteWindow && !satelliteWindow.isDestroyed()) {
            satelliteWindow.show();
        }
    });
    satelliteWindow.loadURL(getSatelliteUrl()).catch((error) => {
        console.error('Failed to load satellite view', error);
    });

    return satelliteWindow;
}

ipcMain.on('satellite-copy-action', (_event, payload) => {
    const value = String(payload?.value ?? payload ?? '');
    if (value) {
        clipboard.writeText(value);
    }
    if (satelliteWindow && !satelliteWindow.isDestroyed()) {
        try {
            satelliteWindow.hide();
            satelliteWindow.blur();
        } catch (error) {
            console.warn('Unable to hide satellite window', error);
        }
    }
    if (robotjs) {
        try {
            const modifier = process.platform === 'darwin' ? 'command' : 'control';
            robotjs.keyTap('v', modifier);
        } catch (error) {
            console.warn('robotjs paste failed', error);
        }
    }
});

ipcMain.on('pdf-detected', (_event, data) => {
    if (satelliteWindow && !satelliteWindow.isDestroyed()) {
        satelliteWindow.show();
        satelliteWindow.setAlwaysOnTop(true, 'screen-saver');
        satelliteWindow.webContents.send('sync-event', { type: 'PDF_DETECTED', ...data });
    }
});

ipcMain.handle('start-scraping', async (_event, { filePath }) => {
    console.log('[Sovereign] Scraping started for:', filePath);
    // Groundwork for PDF scraping engine.
    return { ok: true, message: 'Scraping initialized.' };
});

const setupDownloadsWatcher = () => {
    try {
        const downloadsPath = app.getPath('downloads');
        if (!existsSync(downloadsPath)) return;

        const { watch } = require('fs');
        watch(downloadsPath, (eventType, filename) => {
            if (eventType === 'rename' && filename?.toLowerCase()?.endsWith('.pdf')) {
                const fullPath = join(downloadsPath, filename);
                if (existsSync(fullPath)) {
                    console.log('[Sovereign] New PDF detected in Downloads:', filename);
                    if (satelliteWindow && !satelliteWindow.isDestroyed()) {
                        satelliteWindow.show();
                        satelliteWindow.webContents.send('sync-event', { 
                            type: 'PDF_DETECTED', 
                            filePath: fullPath, 
                            fileName: filename 
                        });
                    }
                }
            }
        });
    } catch (error) {
        console.warn('Failed to initialize downloads watcher:', error);
    }
};

function createWindow() {
    const state = getSavedState();

    mainWindow = new BrowserWindow({
        width: state.width,
        height: state.height,
        x: state.x,
        y: state.y,
        minWidth: 1024,
        minHeight: 768,
        frame: false,
        icon: APP_WINDOW_ICON,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: join(__dirname, 'preload.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            plugins: true
        }
    });

    if (state.isMaximized) {
        mainWindow.maximize();
    }

    if (isDev) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('close', saveState);
    mainWindow.on('resize', saveState);
    mainWindow.on('move', saveState);
    mainWindow.on('closed', () => {
        if (satelliteWindow && !satelliteWindow.isDestroyed()) {
            satelliteWindow.close();
        }
        mainWindow = null;
    });

    const publishMaximizeState = () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.webContents.send('window-maximized-change', mainWindow.isMaximized());
    };

    mainWindow.on('maximize', publishMaximizeState);
    mainWindow.on('unmaximize', publishMaximizeState);

    ipcMain.on('window-minimize', () => mainWindow.minimize());
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.restore();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.on('window-close', () => mainWindow.close());
    ipcMain.removeHandler('window-is-maximized');
    ipcMain.handle('window-is-maximized', () => {
        if (!mainWindow || mainWindow.isDestroyed()) return false;
        return mainWindow.isMaximized();
    });

    ipcMain.on('window-zoom-in', () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const currentZoom = mainWindow.webContents.getZoomLevel();
        mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
    });
    ipcMain.on('window-zoom-out', () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const currentZoom = mainWindow.webContents.getZoomLevel();
        mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
    });
    ipcMain.on('window-zoom-reset', () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.webContents.setZoomLevel(0);
    });
    ipcMain.on('window-always-on-top', (event, flag) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(!!flag);
        }
    });
    publishMaximizeState();
    createSatelliteWindow();

    ipcMain.removeHandler('mail-send');
    ipcMain.handle('mail-send', async (_event, payload) => {
        try {
            const smtp = payload?.smtp || {};
            const google = payload?.google || {};
            const message = payload?.message || {};
            const to = Array.isArray(message.to) ? message.to : [message.to].filter(Boolean);

            if (!to.length) {
                return { ok: false, error: 'Recipient email is required.' };
            }

            let transporterConfig;

            if (google.clientId && google.clientSecret && google.refreshToken) {
                transporterConfig = {
                    service: 'gmail',
                    auth: {
                        type: 'OAuth2',
                        user: google.userEmail,
                        clientId: google.clientId,
                        clientSecret: google.clientSecret,
                        refreshToken: google.refreshToken,
                    }
                };
            } else if (smtp.host && smtp.port && smtp.user && smtp.pass) {
                transporterConfig = {
                    host: String(smtp.host),
                    port: Number(smtp.port),
                    secure: Number(smtp.port) === 465,
                    auth: {
                        user: String(smtp.user),
                        pass: String(smtp.pass),
                    },
                };
            } else {
                return { ok: false, error: 'No valid mail configuration provided (SMTP or Gmail OAuth).' };
            }

            const transporter = nodemailer.createTransport(transporterConfig);

            const fromName = String(smtp.fromName || google.fromName || '').trim();
            const fromEmail = String(smtp.fromEmail || google.userEmail || '').trim();
            const replyToEmail = String(smtp.replyTo || google.replyTo || fromEmail || '').trim();

            const fromHeader = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

            await transporter.sendMail({
                from: fromHeader,
                replyTo: replyToEmail || undefined,
                to,
                subject: String(message.subject || ''),
                html: String(message.html || ''),
                text: String(message.text || ''),
            });

            return { ok: true };
        } catch (error) {
            const rawMessage = String(error?.message || 'Failed to send email.');
            if (rawMessage.includes('550') && rawMessage.toLowerCase().includes('from address')) {
                return {
                    ok: false,
                    error: 'SMTP rejected sender address. Use SMTP User as sender mailbox, or authorize the From address at your mail provider.'
                };
            }
            return { ok: false, error: rawMessage };
        }
    });

    ipcMain.handle('mail-auth-start', async (_event, { clientId, clientSecret, redirectUri }) => {
        return new Promise((resolve, reject) => {
            const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

            const authUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email'],
                prompt: 'consent'
            });

            shell.openExternal(authUrl);

            const server = http.createServer(async (req, res) => {
                try {
                    const urlParts = parse(req.url, true);
                    const code = urlParts.query.code;

                    if (code) {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end('<h1>Authentication Successful!</h1><p>You can close this window now.</p>');
                        
                        const { tokens } = await oauth2Client.getToken(code);
                        resolve({ ok: true, tokens });
                    } else {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end('<h1>Authentication Failed</h1><p>No code found in redirect.</p>');
                        reject(new Error('No code found in redirect'));
                    }
                } catch (err) {
                    res.writeHead(500);
                    res.end('Internal Server Error');
                    reject(err);
                } finally {
                    server.close();
                }
            }).listen(8888);
        });
    });

    ipcMain.removeHandler('desktop-wallpaper-save');
    ipcMain.handle('desktop-wallpaper-save', async (_event, payload) => {
        try {
            const dataUrl = String(payload?.dataUrl || '');
            const fileName = String(payload?.fileName || 'wallpaper');
            const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
            if (!matches) {
                return { ok: false, error: 'Invalid wallpaper image payload.' };
            }

            const mimeType = matches[1];
            const base64 = matches[2];
            const extensionMap = {
                'image/png': '.png',
                'image/jpeg': '.jpg',
                'image/jpg': '.jpg',
                'image/webp': '.webp',
                'image/gif': '.gif',
            };
            const extension = extensionMap[mimeType] || extname(fileName).toLowerCase() || '.png';
            mkdirSync(WALLPAPER_DIR, { recursive: true });
            readdirSync(WALLPAPER_DIR).forEach((entry) => {
                if (entry.startsWith('custom-wallpaper.')) {
                    try {
                        unlinkSync(join(WALLPAPER_DIR, entry));
                    } catch {
                        // Ignore old file cleanup failures.
                    }
                }
            });
            const targetPath = join(WALLPAPER_DIR, `custom-wallpaper${extension}`);
            writeFileSync(targetPath, Buffer.from(base64, 'base64'));
            return {
                ok: true,
                fileUrl: pathToFileURL(targetPath).toString(),
            };
        } catch (error) {
            return { ok: false, error: String(error?.message || 'Failed to save wallpaper file.') };
        }
    });

    ipcMain.removeHandler('document-print-pdf');
    ipcMain.handle('document-print-pdf', async (_event, payload) => {
        try {
            const base64 = String(payload?.base64 || '').trim();
            if (!base64) {
                return { ok: false, error: 'Missing PDF content.' };
            }

            const tempFile = join(
                app.getPath('temp'),
                `acis-print-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.pdf`,
            );
            writeFileSync(tempFile, Buffer.from(base64, 'base64'));

            const printWindow = new BrowserWindow({
                show: false,
                autoHideMenuBar: true,
                webPreferences: {
                    sandbox: true,
                    nodeIntegration: false,
                    contextIsolation: true,
                },
            });

            return await new Promise((resolve) => {
                let settled = false;
                const finish = (result) => {
                    if (settled) return;
                    settled = true;
                    try {
                        if (!printWindow.isDestroyed()) printWindow.close();
                    } catch {
                        // Ignore close cleanup errors.
                    }
                    try {
                        unlinkSync(tempFile);
                    } catch {
                        // Ignore file cleanup errors.
                    }
                    resolve(result);
                };

                printWindow.webContents.on('did-fail-load', (_evt, _code, desc) => {
                    finish({ ok: false, error: `Failed to load PDF for print: ${String(desc || 'Unknown error')}` });
                });

                printWindow.webContents.on('did-finish-load', () => {
                    setTimeout(() => {
                        try {
                            printWindow.webContents.print(
                                {
                                    silent: false,
                                    printBackground: true,
                                    deviceName: String(payload?.deviceName || '').trim() || undefined,
                                },
                                (success, failureReason) => {
                                    if (!success) {
                                        finish({ ok: false, error: String(failureReason || 'Print canceled or failed.') });
                                        return;
                                    }
                                    finish({ ok: true });
                                },
                            );
                        } catch (error) {
                            finish({ ok: false, error: String(error?.message || 'Print failed.') });
                        }
                    }, 280);
                });

                printWindow.loadURL(pathToFileURL(tempFile).toString()).catch((error) => {
                    finish({ ok: false, error: String(error?.message || 'Unable to open print document.') });
                });
            });
        } catch (error) {
            return { ok: false, error: String(error?.message || 'Failed to print document.') };
        }
    });
}

app.whenReady().then(() => {
    setupSovereignPdfViewer();
    setupDownloadsWatcher();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
