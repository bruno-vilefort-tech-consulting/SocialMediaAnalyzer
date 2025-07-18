import path from 'path';
import fs from 'fs';

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

// garante que a pasta exista na primeira importação
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} else {
  //
}