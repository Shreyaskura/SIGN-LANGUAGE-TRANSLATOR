-- ============================================================================
-- SIGN LANGUAGE TRANSLATOR APP - DATABASE SYSTEMS & ENGINEERING (DBS & DBE)
-- File: dbs_queries.sql
-- Description: Complete 3NF Relational Schema (PostgreSQL/SQLite Compatible),
--              Performance Indexes, Seed Data, Analytical Views & SQL Queries.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: DATABASE SCHEMA DDL (3NF Normalization)
-- ----------------------------------------------------------------------------

-- Drop tables if re-initializing (Order respects Foreign Key dependencies)
DROP TABLE IF EXISTS translation_feedback CASCADE;
DROP TABLE IF EXISTS translation_history CASCADE;
DROP TABLE IF EXISTS gestures CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table (Normalized User Entity)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'evaluator')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Sign Language Dictionary Table (Normalized Gesture Entity)
CREATE TABLE gestures (
    gesture_id SERIAL PRIMARY KEY,
    sign_name VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('Alphabet', 'Greetings', 'Numbers', 'Common', 'Phrases', 'Emergency', 'Daily Needs', 'Expressions')),
    description TEXT,
    gesture_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Translation History Table (Transactional Fact Log)
CREATE TABLE translation_history (
    history_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    gesture_id INT REFERENCES gestures(gesture_id) ON DELETE SET NULL,
    recognized_text VARCHAR(100) NOT NULL,
    confidence_score NUMERIC(5,2) NOT NULL CHECK (confidence_score BETWEEN 0.00 AND 100.00),
    output_mode VARCHAR(10) DEFAULT 'text' CHECK (output_mode IN ('text', 'speech', 'both')),
    translated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Translation Feedback Table (User Validation & Model Audit)
CREATE TABLE translation_feedback (
    feedback_id SERIAL PRIMARY KEY,
    history_id INT UNIQUE REFERENCES translation_history(history_id) ON DELETE CASCADE,
    actual_gesture_id INT REFERENCES gestures(gesture_id) ON DELETE RESTRICT,
    is_correct BOOLEAN NOT NULL,
    user_notes TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- SECTION 2: DATABASE ENGINEERING (DBE) INDEXING FOR OPTIMIZATION
-- ----------------------------------------------------------------------------

-- B-Tree Indexes on High-Frequency Search & Filter Columns
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_gestures_category ON gestures(category);
CREATE INDEX idx_translation_user ON translation_history(user_id);
CREATE INDEX idx_translation_time ON translation_history(translated_at DESC);
CREATE INDEX idx_translation_confidence ON translation_history(confidence_score DESC);

-- ----------------------------------------------------------------------------
-- SECTION 3: SEED DATA INSERTION (DML)
-- ----------------------------------------------------------------------------

-- Insert Default Users
INSERT INTO users (username, email, password_hash, role) VALUES
('shreyas_dbs', 'shreyas@dbs.edu', '$2b$12$eImiTXuWVxfM37uY4JANjO5E8.d/X9u7E2t9KqJvQ0u3B0F5kK9/O', 'admin'),
('john_doe', 'john@example.com', '$2b$12$eImiTXuWVxfM37uY4JANjO5E8.d/X9u7E2t9KqJvQ0u3B0F5kK9/O', 'user'),
('evaluator_prof', 'prof@university.edu', '$2b$12$eImiTXuWVxfM37uY4JANjO5E8.d/X9u7E2t9KqJvQ0u3B0F5kK9/O', 'evaluator');

-- Insert Sign Language Dictionary Seed Data
INSERT INTO gestures (sign_name, category, description) VALUES
('HELP', 'Emergency', 'Thumbs up gesture held vertically or placed over flat palm for requesting assistance.'),
('HI / HELLO', 'Greetings', 'Open hand with 4 or 5 fingers extended facing camera.'),
('THANK YOU', 'Greetings', 'Flat palm held open towards viewer.'),
('WATER', 'Daily Needs', 'Index, Middle, and Ring fingers extended forming W shape.'),
('PLEASE', 'Expressions', 'Flat hand placed over chest making gentle circular gesture.'),
('YES', 'Expressions', 'Fist shape (S hand) nodding up and down slightly.'),
('NO', 'Expressions', 'Index, Middle, and Thumb fingertips snapping together.'),
('GOOD / FINE', 'Expressions', 'Flat palm or thumb up pointing upwards gracefully.'),
('SORRY', 'Expressions', 'Closed fist making gentle circular motion near chest.'),
('PEACE / VICTORY', 'Common', 'Index & Middle fingers extended in V shape.'),
('THUMBS UP', 'Common', 'Thumb extended upwards with other fingers folded.'),
('OK SIGN', 'Common', 'Thumb and Index fingertips touching forming a circle.'),
('I LOVE YOU', 'Common', 'Thumb, Index, and Pinky extended together.'),
('STOP / FIST', 'Common', 'Fist with all fingers folded tightly.'),
('POINT / ONE', 'Numbers', 'Index finger pointing up straight.'),
('TWO', 'Numbers', 'Index and Middle fingers extended.'),
('THREE', 'Numbers', 'Thumb, Index, and Middle fingers extended.'),
('ROCK / METAL', 'Common', 'Index and Pinky extended up.'),
('ALPHABET A', 'Alphabet', 'Fist with thumb resting alongside index finger.'),
('ALPHABET B', 'Alphabet', 'Flat hand with 4 fingers together and thumb tucked.'),
('ALPHABET C', 'Alphabet', 'Curved hand forming C shape.'),
('ALPHABET D', 'Alphabet', 'Index finger extended up, thumb and remaining fingers form a circle.'),
('ALPHABET E', 'Alphabet', 'Fingers curled into palm with thumb tucked underneath.'),
('ALPHABET F / OK', 'Alphabet', 'Thumb and index fingertips touching, 3 fingers extended.'),
('ALPHABET I', 'Alphabet', 'Pinky finger extended upwards with other fingers folded.'),
('ALPHABET L', 'Alphabet', 'Thumb and Index finger forming L shape.'),
('ALPHABET O / ZERO', 'Alphabet', 'All fingers curved touching thumb tip forming O.'),
('ALPHABET U', 'Alphabet', 'Index and Middle fingers extended straight up together.'),
('ALPHABET W / WATER', 'Alphabet', 'Index, Middle, and Ring fingers extended in W shape.'),
('ALPHABET X', 'Alphabet', 'Index finger hooked/bent, thumb tucked.'),
('ALPHABET Y', 'Alphabet', 'Thumb and Pinky extended outwards.'),
('FOUR', 'Numbers', 'Four fingers extended upwards, thumb tucked.'),
('FIVE', 'Numbers', 'All five fingers spread open facing forward.');

-- Insert Sample Translation Logs
INSERT INTO translation_history (user_id, gesture_id, recognized_text, confidence_score, output_mode) VALUES
(1, 1, 'HELLO', 98.50, 'both'),
(1, 2, 'THANK YOU', 96.20, 'both'),
(1, 3, 'PEACE / VICTORY', 97.80, 'text'),
(2, 4, 'THUMBS UP', 99.00, 'both'),
(2, 5, 'OK SIGN', 94.50, 'text'),
(2, 1, 'HELLO', 97.10, 'both'),
(1, 6, 'I LOVE YOU', 98.90, 'both');

-- Insert Sample Translation Feedback
INSERT INTO translation_feedback (history_id, actual_gesture_id, is_correct, user_notes) VALUES
(1, 1, TRUE, 'Perfect recognition on first attempt.'),
(2, 2, TRUE, 'Accurate speech output.'),
(5, 5, TRUE, 'Recognized in medium light condition.');

-- ----------------------------------------------------------------------------
-- SECTION 4: ANALYTICAL VIEWS (DBE VIRTUAL TABLES)
-- ----------------------------------------------------------------------------

-- View: User Translation Summary & Confidence Metrics
CREATE OR REPLACE VIEW vw_user_translation_summary AS
SELECT 
    u.user_id,
    u.username,
    u.role,
    COUNT(t.history_id) AS total_translations,
    ROUND(AVG(t.confidence_score), 2) AS avg_confidence_score,
    MAX(t.translated_at) AS last_active_at
FROM users u
LEFT JOIN translation_history t ON u.user_id = t.user_id
GROUP BY u.user_id, u.username, u.role;

-- ----------------------------------------------------------------------------
-- SECTION 5: ADVANCED DBS/DBE QUERIES FOR EVALUATION
-- ----------------------------------------------------------------------------

-- Query 1: Top Most Frequently Translated Signs with Average Confidence
SELECT 
    g.gesture_id,
    g.sign_name,
    g.category,
    COUNT(th.history_id) AS total_recognized_count,
    ROUND(AVG(th.confidence_score), 2) AS average_confidence
FROM gestures g
JOIN translation_history th ON g.gesture_id = th.gesture_id
GROUP BY g.gesture_id, g.sign_name, g.category
ORDER BY total_recognized_count DESC;

-- Query 2: Window Function - User Gesture Recognition Rank
SELECT 
    u.username,
    g.sign_name,
    COUNT(th.history_id) as translation_count,
    DENSE_RANK() OVER (PARTITION BY u.user_id ORDER BY COUNT(th.history_id) DESC) as user_gesture_rank
FROM translation_history th
JOIN users u ON th.user_id = u.user_id
JOIN gestures g ON th.gesture_id = g.gesture_id
GROUP BY u.user_id, u.username, g.gesture_id, g.sign_name;

-- Query 3: Outer Join Audit for Unused Gestures in Dictionary (LEFT & FULL OUTER JOIN)
SELECT 
    g.gesture_id,
    g.sign_name,
    g.category
FROM gestures g
LEFT JOIN translation_history th ON g.gesture_id = th.gesture_id
WHERE th.history_id IS NULL;

-- Query 4: Aggregation with HAVING Clause (High Volume, High Accuracy Categories)
SELECT 
    g.category,
    COUNT(th.history_id) AS total_logged,
    ROUND(AVG(th.confidence_score), 2) AS avg_accuracy
FROM gestures g
JOIN translation_history th ON g.gesture_id = th.gesture_id
GROUP BY g.category
HAVING COUNT(th.history_id) >= 1 AND AVG(th.confidence_score) >= 95.00
ORDER BY avg_accuracy DESC;

-- Query 5: Subquery (Gestures Performing Above the Overall System Average Confidence)
SELECT 
    gesture_id, 
    sign_name, 
    category
FROM gestures
WHERE gesture_id IN (
    SELECT gesture_id 
    FROM translation_history 
    GROUP BY gesture_id 
    HAVING AVG(confidence_score) > (SELECT AVG(confidence_score) FROM translation_history)
);

-- Query 6: Common Table Expression (CTE) - Multi-Stage Analytical Pipeline
WITH CategoryMetrics AS (
    SELECT 
        g.category,
        COUNT(th.history_id) AS trans_count,
        AVG(th.confidence_score) AS cat_avg_conf
    FROM gestures g
    JOIN translation_history th ON g.gesture_id = th.gesture_id
    GROUP BY g.category
),
RankedCategories AS (
    SELECT 
        category,
        trans_count,
        ROUND(cat_avg_conf, 2) AS cat_avg_conf,
        DENSE_RANK() OVER (ORDER BY trans_count DESC) AS popularity_rank
    FROM CategoryMetrics
)
SELECT * FROM RankedCategories WHERE popularity_rank <= 5;

-- ----------------------------------------------------------------------------
-- SECTION 6: CO4 - TRANSACTIONS, ACID PROPERTIES & ISOLATION BOUNDARIES
-- ----------------------------------------------------------------------------

-- Transaction Example: Atomic Gesture Translation Logging & Feedback Ingestion
-- Demonstrates Atomicity, Consistency, Isolation (REPEATABLE READ), and Durability
BEGIN;

-- Set Transaction Isolation Level (Guarantees repeatable reads without phantom anomalies)
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- 1. Insert into translation_history
INSERT INTO translation_history (user_id, gesture_id, recognized_text, confidence_score, output_mode)
VALUES (1, 2, 'THANK YOU', 98.00, 'both')
RETURNING history_id;

-- 2. Create Savepoint to protect against partial failures
SAVEPOINT after_history_insert;

-- 3. Ingest User Feedback linked to the transaction
INSERT INTO translation_feedback (history_id, actual_gesture_id, is_correct, user_notes)
VALUES (currval(pg_get_serial_sequence('translation_history', 'history_id')), 2, TRUE, 'Perfect pose verification');

-- 4. Commit transaction atomically
COMMIT;

-- ----------------------------------------------------------------------------
-- SECTION 7: CO5 - COVERING INDEXES, QUERY OPTIMIZATION & EXPLAIN PLANS
-- ----------------------------------------------------------------------------

-- Composite & Covering Index for Index-Only Scans
CREATE INDEX idx_user_trans_covering ON translation_history(user_id, confidence_score) 
INCLUDE (recognized_text, translated_at);

-- Multi-column Composite Index for User Time-Series queries
CREATE INDEX idx_user_timestamp ON translation_history(user_id, translated_at DESC);

-- EXPLAIN ANALYZE Execution Plans
-- 1. Index Scan using B-Tree index:
EXPLAIN ANALYZE 
SELECT history_id, recognized_text, confidence_score 
FROM translation_history 
WHERE user_id = 1 AND confidence_score > 90.00;

-- 2. Covering Index-Only Scan (Avoids Heap Fetch entirely):
EXPLAIN ANALYZE 
SELECT user_id, confidence_score, recognized_text, translated_at 
FROM translation_history 
WHERE user_id = 1 AND confidence_score >= 95.00;

-- ----------------------------------------------------------------------------
-- SECTION 8: CO6 - DISTRIBUTED PERSISTENCE & HORIZONTAL SCALING STRATEGY
-- ----------------------------------------------------------------------------
-- 1. Polyglot Persistence:
--    - PostgreSQL (ACID/Relational): Manages Users, Gestures, and Validated Logs (CP/Consistency prioritized).
--    - MongoDB (NoSQL Document Store): Stores high-velocity, flexible 3D hand landmark telemetry frames (AP/Availability prioritized).
-- 2. Read Scaling:
--    - Primary (Port 5432) handles writes (INSERT translation_history).
--    - Read-Replicas handle analytical dashboards and reports (vw_user_translation_summary).
-- 3. Horizontal Sharding Strategy:
--    - Partitioning translation_history by Range (translated_at) or Hash (user_id % num_shards).

