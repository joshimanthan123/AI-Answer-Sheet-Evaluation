import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

function generateStrokesForText(text) {
  const strokes = [];
  let cursorX = 50.0;
  let cursorY = 100.0;

  const addStroke = (pts, width = 6, color = "#000000") => {
    strokes.push({
      points: pts.map(p => ({ x: p[0], y: p[1] })),
      width,
      color
    });
  };

  for (const char of text.toUpperCase()) {
    const cx = cursorX;
    const cy = cursorY;
    if (char === 'P') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy], [cx + 40, cy], [cx + 40, cy + 50], [cx, cy + 50]]);
      cursorX += 55;
    } else if (char === 'A') {
      addStroke([[cx, cy + 100], [cx + 25, cy]]);
      addStroke([[cx + 25, cy], [cx + 50, cy + 100]]);
      addStroke([[cx + 10, cy + 60], [cx + 40, cy + 60]]);
      cursorX += 60;
    } else if (char === 'D') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy], [cx + 35, cy + 20], [cx + 35, cy + 80], [cx, cy + 100]]);
      cursorX += 55;
    } else if (char === 'L') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy + 100], [cx + 40, cy + 100]]);
      cursorX += 50;
    } else if (char === 'E') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy], [cx + 40, cy]]);
      addStroke([[cx, cy + 50], [cx + 30, cy + 50]]);
      addStroke([[cx, cy + 100], [cx + 40, cy + 100]]);
      cursorX += 50;
    } else if (char === 'O') {
      addStroke([[cx, cy], [cx + 40, cy], [cx + 40, cy + 100], [cx, cy + 100], [cx, cy]]);
      cursorX += 55;
    } else if (char === 'C') {
      addStroke([[cx + 40, cy], [cx, cy], [cx, cy + 100], [cx + 40, cy + 100]]);
      cursorX += 50;
    } else if (char === 'R') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy], [cx + 40, cy], [cx + 40, cy + 50], [cx, cy + 50]]);
      addStroke([[cx + 15, cy + 50], [cx + 40, cy + 100]]);
      cursorX += 55;
    } else if (char === 'T') {
      addStroke([[cx, cy], [cx + 50, cy]]);
      addStroke([[cx + 25, cy], [cx + 25, cy + 100]]);
      cursorX += 60;
    } else if (char === 'S') {
      addStroke([[cx + 40, cy], [cx, cy], [cx, cy + 50], [cx + 40, cy + 50], [cx + 40, cy + 100], [cx, cy + 100]]);
      cursorX += 50;
    } else {
      cursorX += 30;
    }
  }
  return strokes;
}

async function testDirectStrokeOCR() {
  console.log("=================================================");
  console.log("   DIRECT PADDLEOCR STROKE INFERENCE TEST        ");
  console.log("=================================================\n");

  const strokes = generateStrokesForText("PADDLE OCR TEST");
  console.log(`Generated ${strokes.length} canvas strokes for text 'PADDLE OCR TEST'.`);

  const payload = {
    strokes,
    width: 800,
    height: 600,
    page_num: 1
  };

  const response = await fetch("http://127.0.0.1:8000/api/v1/ocr/recognize-strokes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const resJson = await response.json();
  console.log("FastAPI Response Status:", response.status);
  console.log("Response Body:\n", JSON.stringify(resJson, null, 2));

  if (response.ok && resJson.success && resJson.data) {
    console.log("\n--- RESULT ANALYSIS ---");
    console.log("Provider Used:", resJson.data.provider);
    console.log("Recognized Text:", resJson.data.text);
    console.log("Confidence Score:", resJson.data.confidence);
    console.log("Execution Time (s):", resJson.data.execution_time);
    console.log("Lines Count:", resJson.data.lines?.length);

    if (resJson.data.provider === 'paddle' && resJson.data.text !== undefined) {
      console.log("\n>>> DIRECT STROKE PADDLEOCR TEST: PASS <<<");
    } else {
      console.log("\n>>> DIRECT STROKE PADDLEOCR TEST: FAIL (Wrong provider or empty text) <<<");
    }
  } else {
    console.log("\n>>> DIRECT STROKE PADDLEOCR TEST: FAIL <<<");
  }
}

testDirectStrokeOCR().catch(err => {
  console.error("Direct stroke test error:", err);
  process.exit(1);
});
