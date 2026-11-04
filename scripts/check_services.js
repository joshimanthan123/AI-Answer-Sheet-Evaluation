import http from 'http';

function checkService(name, host, port, path = '/') {
  return new Promise((resolve) => {
    const req = http.request({ host, port, path, method: 'GET', timeout: 3000 }, (res) => {
      console.log(`[SERVICE OK] ${name} at http://${host}:${port}${path} (Status: ${res.statusCode})`);
      resolve(true);
    });
    req.on('error', (err) => {
      console.log(`[SERVICE DOWN] ${name} at http://${host}:${port}${path} (${err.message})`);
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      console.log(`[SERVICE TIMEOUT] ${name} at http://${host}:${port}${path}`);
      resolve(false);
    });
    req.end();
  });
}

async function main() {
  console.log("Checking Live Services Status...\n");
  const frontend = await checkService("Frontend (React/Vite)", "localhost", 5173);
  const backend = await checkService("Backend (Node/Express)", "localhost", 5000, "/api/v1/health");
  const ocr = await checkService("OCR Service (FastAPI)", "localhost", 8000, "/health");
  
  console.log("\nSummary:");
  console.log(`- Frontend : ${frontend ? 'ONLINE ✅' : 'OFFLINE ❌'}`);
  console.log(`- Backend  : ${backend ? 'ONLINE ✅' : 'OFFLINE ❌'}`);
  console.log(`- OCR      : ${ocr ? 'ONLINE ✅' : 'OFFLINE ❌'}`);
}

main();
