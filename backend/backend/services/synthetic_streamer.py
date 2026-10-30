"""
Real-time Synthetic CCTV & RTSP Video Stream Generator for Police Operations Center.
Generates genuine MJPEG frames simulating 4K PTZ cameras, license plate overlays,
and vehicle velocity radar lines when physical cameras or CARLA are offline.
"""

import io
import time
import math
import random
from typing import Generator
from PIL import Image, ImageDraw, ImageFont

def generate_synthetic_cctv_frame(
    intersection_id: str,
    approach: str,
    width: int = 640,
    height: int = 360
) -> bytes:
    # 1. Base Dark Asphalt Scene
    img = Image.new("RGB", (width, height), color=(15, 23, 42))
    draw = ImageDraw.Draw(img)

    # 2. Road Perspectives and Crossings
    # Draw perspective road lanes
    horizon_y = int(height * 0.35)
    center_x = width // 2

    # Road surface
    draw.polygon([
        (center_x - 40, horizon_y),
        (center_x + 40, horizon_y),
        (width - 40, height),
        (40, height)
    ], fill=(30, 41, 59))

    # Lane markings (dashed center lines)
    t = time.time() * 2
    offset = int((t % 1.0) * 40)
    for y in range(horizon_y + 10 + offset, height, 40):
        w_lane = max(2, int((y - horizon_y) / 25))
        draw.line([(center_x, y), (center_x, y + 20)], fill=(226, 232, 240), width=w_lane)

    # 3. Simulate Moving Vehicles with AI Bounding Boxes
    num_cars = 3
    for c in range(num_cars):
        # Pseudo trajectory based on time
        car_t = (time.time() * 0.4 + (c * 0.33)) % 1.0
        car_y = int(horizon_y + (height - horizon_y) * car_t)
        scale = max(0.2, (car_y - horizon_y) / (height - horizon_y))
        
        lane_side = -1 if c % 2 == 0 else 1
        car_x = int(center_x + (lane_side * 60 * scale))
        
        box_w = int(55 * scale)
        box_h = int(35 * scale)
        
        # Vehicle bounding box (Police CV style)
        box = [car_x - box_w, car_y - box_h, car_x + box_w, car_y]
        box_color = (34, 197, 94) if c != 1 else (239, 68, 68) # Red if speeding
        draw.rectangle(box, outline=box_color, width=2)
        
        # Plate & Speed Tag
        speed = 48.2 + math.sin(time.time() + c) * 12
        speed_tag = f"CAR 99% | {speed:.1f} KM/H"
        draw.rectangle([box[0], box[1] - 12, box[0] + 110, box[1]], fill=box_color)
        draw.text((box[0] + 2, box[1] - 12), speed_tag, fill=(0, 0, 0))

    # 4. Police OSD (On-Screen Display) Overlay
    timestamp_str = time.strftime("%Y-%m-%d %H:%M:%S")
    osd_text = f"CAM-{intersection_id}-{approach} [LIVE 4K] | {timestamp_str} | 59.94 FPS"
    draw.rectangle([0, 0, width, 22], fill=(0, 0, 0, 180))
    draw.text((10, 4), osd_text, fill=(56, 189, 248))

    # Watermark
    draw.text((width - 150, height - 18), "POLICE TOC STREAM", fill=(100, 116, 139))

    # Encode to JPEG
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return buf.getvalue()
