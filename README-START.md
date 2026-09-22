# How to Start the Sign Language Translator

## Quick Start Guide

### Method 1: Using Batch Files (Easiest)

1. **Double-click** `start-server.bat` to start the frontend server
   - Opens at: **http://localhost:8080**

2. **Double-click** `start-backend.bat` to start the backend API (optional)
   - Opens at: **http://localhost:8000**
   - API Docs: **http://localhost:8000/docs**

### Method 2: Using Terminal

**Start Frontend (with Hand Model):**
```bash
node server.js
```
Then open: **http://localhost:8080**

**Start Backend API:**
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```
Then open: **http://localhost:8000/docs**

---

## What You'll See

The frontend includes:
- ✅ **3D Hand Model** - Realistic rigged hand with gesture animations
- ✅ **Live Camera Recognition** - MediaPipe hand tracking
- ✅ **Sign Language Translation** - Real-time gesture detection
- ✅ **Visual Guide** - Interactive sign language learning

## Troubleshooting

**Problem: Port 8080 already in use**
- Solution: Kill existing Node process or change PORT in server.js

**Problem: Hand model not loading**
- Check if `assets/hand_right.glb` exists
- Check browser console (F12) for errors

**Problem: Camera not working**
- Grant camera permissions when prompted
- Use HTTPS or localhost only (MediaPipe requirement)

---

## Files Overview

- `index.html` - Main application page
- `hand3d.js` - 3D hand model controller (61KB)
- `app.js` - Gesture recognition engine (81KB)
- `server.js` - Static file server
- `assets/hand_right.glb` - 3D hand model file

## Localhost Links

- Frontend: http://localhost:8080
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs
