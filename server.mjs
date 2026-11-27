import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVoiceRoutes } from './voice-server.mjs';

try{process.loadEnvFile?.(fileURLToPath(new URL('./.env.local',import.meta.url)));}
catch(error){if(error.code!=='ENOENT')throw error;}
const root = resolve(fileURLToPath(new URL('./public', import.meta.url)));
const port = Number(process.env.PORT || 4185);
const voiceRoutes=createVoiceRoutes({apiKey:process.env.ELEVENLABS_API_KEY,voiceId:process.env.ELEVENLABS_VOICE_ID});
const contentTypes = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.wasm':'application/wasm',
  '.glb':'model/gltf-binary',
  '.webp':'image/webp',
  '.jpg':'image/jpeg',
  '.png':'image/png',
  '.wav':'audio/wav',
  '.mp3':'audio/mpeg'
};

createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(await voiceRoutes(pathname,req,res))return;
    const path = resolve(root,'.'+(pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root+sep)) throw new Error('Invalid path');
    const file = await stat(path);
    if (!file.isFile()) throw new Error('Missing file');
    res.writeHead(200, {
      'Content-Type': contentTypes[extname(path)] || 'application/octet-stream',
      'Content-Length': file.size,
      'X-Content-Type-Options': 'nosniff'
    });
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(path);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch {
    res.writeHead(404).end('File not found');
  }
}).listen(port,'127.0.0.1', () => console.log('Model viewer running at http://127.0.0.1:'+port));




