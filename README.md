# 🖐️ Sign Language Translator App
### **Academic Coursework Project for Database Systems (DBS) & Database Engineering (DBE)**

---

## 📌 Project Overview & Abstract

The **Sign Language Translator App** is designed to bridge the communication gap for deaf and hard-of-hearing individuals. By capturing live hand gestures via webcam sensors, the application utilizes computer vision landmarks and heuristic/ML classification to convert sign language gestures into text and real-time speech.

For **Database Systems (DBS)** and **Database Engineering (DBE)** evaluation, this project demonstrates a **Hybrid Database Architecture**:
1. **Relational Database (PostgreSQL / SQLite)**: 3NF normalized transactional system storing structured data (`users`, `gestures`, `translation_history`, `translation_feedback`).
2. **NoSQL Document Database (MongoDB)**: High-frequency document store persisting raw 3D hand keypoints `(x, y, z)` streaming at 30 FPS.

---

## 🏛️ System Architecture

```
+-------------------------------------------------------------+
|                📱 Web Application Frontend                  |
|  (Live Camera Feed, Landmark Canvas, Text-to-Speech Engine) |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                     ⚡ FastAPI Backend API                   |
|     (JWT Authentication, Gesture Classifier, REST Routers)  |
+---------------+-----------------------------+---------------+
                |                             |
                v                             v
+-------------------------------+   +-------------------------------+
|  🐘 Relational SQL Database   |   |   🍃 NoSQL Document Database  |
|  (PostgreSQL / SQLite 3NF)    |   |           (MongoDB)           |
| Users, History, Dictionary    |   | 3D Keypoint Streams (x,y,z)   |
+-------------------------------+   +-------------------------------+
```

---

## 🗄️ Database Normalization & Engineering (DBS/DBE)

### 1. Relational Database Normalization (3NF)
- **1NF (First Normal Form)**: Atomic column values; no repeating groups.
- **2NF (Second Normal Form)**: All non-key attributes are fully dependent on the primary key.
- **3NF (Third Normal Form)**: No transitive functional dependencies exist (e.g., user profiles and gesture attributes are isolated in distinct tables linked via Foreign Keys).

### 2. Indexes & Performance Optimization
- `idx_users_username`: B-Tree index for fast authentication lookup $O(\log N)$.
- `idx_translation_time`: Index on `translated_at DESC` for fast historical pagination.
- `idx_gestures_category`: Category filter indexing for gesture dictionary queries.

---

## 🚀 How to Run the Application

### Option A: Running the Web App (Frontend + Local Server)
1. Open terminal in the project directory:
   ```bash
   node server.js
   ```
2. Open your web browser and navigate to:
   ```
   http://localhost:8080/
   ```
3. Allow webcam permissions, click **"Start Camera"**, and test live gesture translation!

### Option B: Running the Full Stack with Docker Compose
To launch FastAPI, PostgreSQL, MongoDB, and pgAdmin together:
```bash
docker-compose up --build
```
- **Web App**: `http://localhost:8080/`
- **FastAPI Documentation**: `http://localhost:8000/docs`
- **pgAdmin GUI**: `http://localhost:5050` (Email: `admin@dbs.com`, Password: `adminpassword`)

---

## 📊 SQL Evaluation Queries

All DDL, seed data, and analytical queries are provided in `dbs_queries.sql`.

```sql
-- Analytical Window Query: Ranking Top Recognized Signs per User
SELECT 
    u.username,
    g.sign_name,
    COUNT(th.history_id) as translation_count,
    DENSE_RANK() OVER (PARTITION BY u.user_id ORDER BY COUNT(th.history_id) DESC) as user_rank
FROM translation_history th
JOIN users u ON th.user_id = u.user_id
JOIN gestures g ON th.gesture_id = g.gesture_id
GROUP BY u.user_id, u.username, g.gesture_id, g.sign_name;
```

---

## 👥 Authors & Academic Context
Developed for **DBS (Database Systems)** & **DBE (Database Engineering)** Coursework Project.
