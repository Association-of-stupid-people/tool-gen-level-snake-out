
import unittest
import numpy as np
import cv2
from app.services.image_processor import _resize_contain

class TestAspectRatio(unittest.TestCase):
    def test_resize_contain_square(self):
        # 100x100 image -> 20x20 target
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        res = _resize_contain(img, 20, 20)
        self.assertEqual(res.shape, (20, 20, 3))
        
    def test_resize_contain_landscape(self):
        # 100x50 image (2:1) -> 20x20 target
        # Should become 20x10, then padded to 20x20
        # Padding: (20-10)/2 = 5 top, 5 bottom
        img = np.zeros((50, 100, 3), dtype=np.uint8)
        # Fill with white to check padding color if needed
        img.fill(255)
        
        res = _resize_contain(img, 20, 20)
        self.assertEqual(res.shape, (20, 20, 3))
        
        # Verify padding exists? (Assuming logic pads with specific color)
        # For now just verify shape is robust
        
    def test_resize_contain_portrait(self):
        # 50x100 image (1:2) -> 20x20 target
        # Should become 10x20, then padded to 20x20
        # Padding: 5 left, 5 right
        img = np.zeros((100, 50, 3), dtype=np.uint8)
        res = _resize_contain(img, 20, 20)
        self.assertEqual(res.shape, (20, 20, 3))

if __name__ == '__main__':
    unittest.main()
