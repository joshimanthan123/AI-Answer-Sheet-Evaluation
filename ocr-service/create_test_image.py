import cv2
import numpy as np

img = np.ones((100, 300, 3), dtype=np.uint8) * 255
cv2.putText(img, "Test 123", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 0), 3)
cv2.imwrite("test_handwriting.png", img)
print("Created test_handwriting.png")
