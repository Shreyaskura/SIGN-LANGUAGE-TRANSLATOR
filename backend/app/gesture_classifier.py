import math

def calculate_distance_2d(p1, p2):
    return math.sqrt((p1['x'] - p2['x']) ** 2 + (p1['y'] - p2['y']) ** 2)

def classify_landmarks(landmarks):
    """
    Classifies 21 MediaPipe hand landmark keypoints into recognized sign language gesture.
    landmarks: list of dicts [{'id': 0, 'x': ..., 'y': ..., 'z': ...}, ...]
    """
    if not landmarks or len(landmarks) < 21:
        return {"sign_name": "UNKNOWN", "confidence": 0.0, "category": "None"}

    lm = {item.get('id', idx): item for idx, item in enumerate(landmarks)}
    wrist = lm[0]

    def is_finger_extended(tip_idx, pip_idx):
        return calculate_distance_2d(lm[tip_idx], wrist) > (calculate_distance_2d(lm[pip_idx], wrist) * 1.05)

    is_index_extended = is_finger_extended(8, 6)
    is_middle_extended = is_finger_extended(12, 10)
    is_ring_extended = is_finger_extended(16, 14)
    is_pinky_extended = is_finger_extended(20, 18)

    thumb_wrist_dist = calculate_distance_2d(lm[4], wrist)
    index_mcp_dist = calculate_distance_2d(lm[5], wrist)
    is_thumb_extended = thumb_wrist_dist > (index_mcp_dist * 0.95)

    thumb_index_dist = calculate_distance_2d(lm[4], lm[8])
    is_thumb_up = lm[4]['y'] < lm[2]['y'] and (wrist['y'] - lm[4]['y']) > 0.10

    extended_count = sum([is_index_extended, is_middle_extended, is_ring_extended, is_pinky_extended])

    # 1. I LOVE YOU (🤟) vs ROCK / METAL (🤘)
    if is_index_extended and is_pinky_extended and not is_middle_extended and not is_ring_extended:
        if is_thumb_extended:
            return {"sign_name": "I LOVE YOU", "confidence": 98.0, "category": "Common"}
        else:
            return {"sign_name": "ROCK / METAL", "confidence": 96.0, "category": "Common"}

    # 2. THUMBS UP vs HELP
    if extended_count == 0 and is_thumb_up:
        return {"sign_name": "THUMBS UP", "confidence": 99.0, "category": "Common"}

    # 3. ALPHABET L (Thumb & Index at ~90 degrees, others folded)
    if is_index_extended and is_thumb_extended and not is_middle_extended and not is_ring_extended and not is_pinky_extended:
        return {"sign_name": "ALPHABET L", "confidence": 97.0, "category": "Alphabet"}

    # 4. ALPHABET Y / CALL ME (Thumb & Pinky extended, others folded)
    if is_pinky_extended and is_thumb_extended and not is_index_extended and not is_middle_extended and not is_ring_extended:
        return {"sign_name": "ALPHABET Y", "confidence": 97.0, "category": "Alphabet"}

    # 5. ALPHABET I (Only Pinky extended, others folded)
    if is_pinky_extended and not is_thumb_extended and not is_index_extended and not is_middle_extended and not is_ring_extended:
        return {"sign_name": "ALPHABET I", "confidence": 96.0, "category": "Alphabet"}

    # 6. POINT / NUMBER 1 (Only Index extended)
    if is_index_extended and not is_middle_extended and not is_ring_extended and not is_pinky_extended:
        return {"sign_name": "POINT / ONE", "confidence": 97.0, "category": "Numbers"}

    # 7. NUMBER 2 vs PEACE / V vs ALPHABET U
    if is_index_extended and is_middle_extended and not is_ring_extended and not is_pinky_extended:
        index_middle_spread = calculate_distance_2d(lm[8], lm[12])
        if index_middle_spread > 0.06:
            return {"sign_name": "PEACE / VICTORY / V", "confidence": 98.0, "category": "Common"}
        else:
            return {"sign_name": "ALPHABET U", "confidence": 95.0, "category": "Alphabet"}

    # 8. NUMBER 3 (Thumb, Index, Middle extended)
    if is_index_extended and is_middle_extended and is_thumb_extended and not is_ring_extended and not is_pinky_extended:
        return {"sign_name": "NUMBER 3", "confidence": 96.0, "category": "Numbers"}

    # 9. WATER / ALPHABET W (Index, Middle, Ring extended spread)
    if is_index_extended and is_middle_extended and is_ring_extended and not is_pinky_extended:
        return {"sign_name": "WATER / ALPHABET W", "confidence": 98.0, "category": "Daily Needs"}

    # 10. NUMBER 4 vs ALPHABET B
    if is_index_extended and is_middle_extended and is_ring_extended and is_pinky_extended and not is_thumb_extended:
        index_middle_spread = calculate_distance_2d(lm[8], lm[12])
        if index_middle_spread < 0.045:
            return {"sign_name": "ALPHABET B", "confidence": 97.0, "category": "Alphabet"}
        else:
            return {"sign_name": "NUMBER 4", "confidence": 96.0, "category": "Numbers"}

    # 11. OPEN 5 FINGERS: HI / HELLO vs THANK YOU vs PLEASE
    if extended_count >= 4 and is_thumb_extended:
        index_middle_spread = calculate_distance_2d(lm[8], lm[12])
        is_fingers_together = index_middle_spread < 0.05
        is_near_chin = lm[8]['y'] < 0.35 and wrist['y'] < 0.50

        if is_fingers_together and is_near_chin:
            return {"sign_name": "THANK YOU", "confidence": 98.0, "category": "Greetings"}
        elif is_fingers_together and 0.40 <= wrist['y'] <= 0.85:
            return {"sign_name": "PLEASE", "confidence": 95.0, "category": "Expressions"}
        else:
            return {"sign_name": "HI / HELLO", "confidence": 99.0, "category": "Greetings"}

    # 12. OK SIGN / ALPHABET F (Thumb & Index tips touching, other 3 extended)
    if thumb_index_dist < 0.075 and is_middle_extended and is_ring_extended and is_pinky_extended:
        return {"sign_name": "OK SIGN / F", "confidence": 97.0, "category": "Common"}

    # 13. ALPHABET D (Index extended straight, thumb touches middle & ring)
    if is_index_extended and not is_middle_extended and not is_ring_extended and calculate_distance_2d(lm[4], lm[12]) < 0.08:
        return {"sign_name": "ALPHABET D", "confidence": 95.0, "category": "Alphabet"}

    # 14. ALPHABET C (Curved hand in C shape)
    if 0.08 < thumb_index_dist < 0.22 and not is_pinky_extended and calculate_distance_2d(lm[8], lm[5]) < 0.12:
        return {"sign_name": "ALPHABET C", "confidence": 95.0, "category": "Alphabet"}

    # 15. ALPHABET O / NUMBER 0 (Thumb touches index/middle tips in round loop)
    if thumb_index_dist < 0.06 and not is_middle_extended and not is_ring_extended and not is_pinky_extended:
        return {"sign_name": "ALPHABET O / ZERO", "confidence": 96.0, "category": "Alphabet"}

    # 16. NO (Index, Middle, Thumb fingertips snapping together)
    if calculate_distance_2d(lm[4], lm[8]) < 0.06 and calculate_distance_2d(lm[4], lm[12]) < 0.07 and not is_ring_extended and not is_pinky_extended:
        return {"sign_name": "NO", "confidence": 96.0, "category": "Expressions"}

    # 17. ZERO EXTENDED FINGERS (Fist shapes: HELP, YES, SORRY, ALPHABET A, ALPHABET E, STOP)
    if extended_count == 0:
        if calculate_distance_2d(lm[4], lm[6]) < 0.08:
            return {"sign_name": "SORRY", "confidence": 96.0, "category": "Expressions"}
        elif calculate_distance_2d(lm[4], lm[5]) < 0.11 and lm[4]['y'] < lm[3]['y']:
            return {"sign_name": "ALPHABET A", "confidence": 95.0, "category": "Alphabet"}
        elif calculate_distance_2d(lm[4], lm[10]) < 0.09:
            return {"sign_name": "YES", "confidence": 95.0, "category": "Expressions"}
        else:
            return {"sign_name": "STOP / FIST", "confidence": 94.0, "category": "Common"}

    return {"sign_name": "CUSTOM SIGN", "confidence": 85.0, "category": "Custom"}
