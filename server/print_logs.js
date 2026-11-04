import fs from 'fs';
import path from 'path';

function tailFile(filename, lineCount) {
  const filePath = path.resolve(filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const tail = lines.slice(-lineCount);
  console.log(`--- LAST ${lineCount} LINES of ${filename} ---`);
  console.log(tail.join('\n'));
}

tailFile('logs/combined.log', 150);
