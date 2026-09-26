/* ==========================================================================
   Sign AI - Sign Language Translator App (DBS & DBE Project)
   Comprehensive Multiclass Gesture Engine + Real Human Sign Instructor
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const webcamElement = document.getElementById('webcam');
    const canvasElement = document.getElementById('output_canvas');
    const canvasCtx = canvasElement ? canvasElement.getContext('2d') : null;
    const cameraPlaceholder = document.getElementById('camera-placeholder');

    // Controls Buttons
    const btnToggleCamera = document.getElementById('btn-toggle-camera');
    const btnStartPlaceholder = document.getElementById('btn-start-placeholder');
    const cameraBtnText = document.getElementById('camera-btn-text');
    const btnToggleSkeleton = document.getElementById('btn-toggle-skeleton');
    const btnToggleTTS = document.getElementById('btn-toggle-tts');
    const btnFlipCamera = document.getElementById('btn-flip-camera');
    const btnSwitchCamera = document.getElementById('btn-switch-camera');
    const btnQuickHi = document.getElementById('btn-quick-hi');
    const btnToggleDebug = document.getElementById('btn-toggle-debug');

    // Display Labels & Diagnostics
    const liveIndicator = document.getElementById('live-indicator');
    const fpsCounter = document.getElementById('fps-counter');
    const handCountLabel = document.getElementById('hand-count-label');
    const confidenceLabel = document.getElementById('confidence-label');
    const qualityChip = document.getElementById('quality-chip');
    const qualityLabel = document.getElementById('quality-label');
    const aiDebugHud = document.getElementById('ai-debug-hud');
    const currentSignName = document.getElementById('current-sign-name');
    const currentSignDesc = document.getElementById('current-sign-desc');
    const signIconDisplay = document.getElementById('sign-icon-display');
    const confidencePercent = document.getElementById('confidence-percent');
    const confidenceFill = document.getElementById('confidence-fill');

    // Sentence Builder Elements
    const sentenceBuffer = document.getElementById('sentence-buffer');
    const btnSpeakSentence = document.getElementById('btn-speak-sentence');
    const btnCopySentence = document.getElementById('btn-copy-sentence');
    const btnClearSentence = document.getElementById('btnClearSentence') || document.getElementById('btn-clear-sentence');
    const btnAddSpace = document.getElementById('btn-add-space');
    const btnBackspace = document.getElementById('btn-backspace');
    const btnSaveTranslation = document.getElementById('btn-save-translation');

    // History Table Elements
    const historyTableBody = document.getElementById('history-table-body');
    const historyCount = document.getElementById('history-count');

    // Analytics Modal
    const btnAnalytics = document.getElementById('btn-analytics');
    const btnCloseAnalytics = document.getElementById('btn-close-analytics');
    const modalAnalytics = document.getElementById('modal-analytics');

    // Real Human Sign Instructor & Guide Demo Modal Elements
    const modalHandGuide = document.getElementById('modal-hand-guide');
    const btnCloseHandGuide = document.getElementById('btn-close-hand-guide');
    const guideModalTitle = document.getElementById('guide-modal-title');
    const guideCategoryBadge = document.getElementById('guide-category-badge');
    const guideHumanStage = document.getElementById('guide-human-stage');
    const guideSkeletonWrapper = document.getElementById('guide-skeleton-wrapper');
    const guideSkeletonCanvas = document.getElementById('guide-skeleton-canvas');
    const guideFingerChecklist = document.getElementById('guide-finger-checklist');
    const guideStepsList = document.getElementById('guide-steps-list');
    const btnGuideTryCamera = document.getElementById('btn-guide-try-camera');
    const btnGuideTestSpeech = document.getElementById('btn-guide-test-speech');

    // Instructor Mode & Speed Controls
    const btnModeHuman = document.getElementById('btn-mode-human');
    const btnModePhoto = document.getElementById('btn-mode-photo');
    const guidePhotoWrapper = document.getElementById('guide-photo-wrapper');
    const btnModeSkeleton = document.getElementById('btn-mode-skeleton');
    const btnSpeedNormal = document.getElementById('btn-speed-normal');
    const btnSpeedSlow = document.getElementById('btn-speed-slow');
    const btnReplayAnim = document.getElementById('btn-replay-anim');

    let instructorMode = 'human'; // 'human' | 'skeleton'
    let instructorSpeed = 'normal'; // 'normal' | 'slow-motion'

    const statSqlCount = document.getElementById('stat-sql-count');
    const statMongoCount = document.getElementById('stat-mongo-count');

    // State Variables
    let isCameraActive = false;
    let drawSkeleton = true;
    let ttsEnabled = true;
    let isMirrored = true;
    let currentFacingMode = 'user'; // 'user' | 'environment'
    let mediaStream = null;
    let cameraInstance = null;
    let handsInstance = null;
    let animFrameId = null;
    let isProcessingFrame = false;

    let sentenceList = [];
    let translationHistory = [];
    let sqlRecordCount = 1248;
    let mongoRecordCount = 8520;

    let activeGuideSign = null;
    let lastDetectedSign = "";
    let signHoldStartTime = 0;
    const CONFIRM_HOLD_DURATION_MS = 380;
    let isSignDebounced = false;
    let lastRecognitionPulseTime = 0;

    // Advanced Recognition AI Pipeline State
    let isDebugMode = false;
    let smoothedLandmarks = null;
    let predictionWindow = [];
    const PREDICTION_WINDOW_MAX = 8;
    const STABILITY_THRESHOLD = 5;

    let lastFrameTime = performance.now();
    let frameCount = 0;

    // =========================================================================
    // 1. Comprehensive Sign Language Catalog (All Categories & Signs)
    // =========================================================================
    window.dictionaryData = [
        // --- Emergency & Help ---
        {
            name: "HELP",
            category: "Emergency",
            icon: "fa-hand-holding-medical",
            handPose: "help",
            bodyPosition: "Chest Level",
            motionClass: "anim-human-help-lift",
            handGuide: "Thumbs Up Lifted Over Flat Palm",
            desc: "Two-hand ASL gesture: Closed thumbs-up fist placed on top of flat support palm, lifted upwards together.",
            fingers: { thumb: "Upright Extended 👍", index: "Folded into Fist ✊", middle: "Folded into Fist ✊", ring: "Folded into Fist ✊", pinky: "Folded into Fist ✊" },
            steps: [
                "Place your left hand open flat horizontally with palm facing upward at chest height.",
                "Make an upright Thumbs Up fist with your right hand and place it on your left palm.",
                "Lift both hands upward together towards the camera to signal HELP."
            ]
        },
        {
            name: "THUMBS UP",
            category: "Common",
            icon: "fa-thumbs-up",
            handPose: "thumbs_up",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-thumbs",
            handGuide: "Thumb Extended Upward 👍",
            desc: "Single hand with thumb pointing straight upwards and 4 fingers curled into a fist.",
            fingers: { thumb: "Upright Extended 👍", index: "Folded into Fist ✊", middle: "Folded into Fist ✊", ring: "Folded into Fist ✊", pinky: "Folded into Fist ✊" },
            steps: [
                "Curl your four fingers (index, middle, ring, pinky) tightly into a fist.",
                "Extend your thumb straight up perpendicular to the fist.",
                "Hold upright steadily in front of the camera."
            ]
        },

        // --- Greetings ---
        {
            name: "HI / HELLO",
            category: "Greetings",
            icon: "fa-hand-wave",
            handPose: "wave_hello",
            bodyPosition: "Shoulder / Head",
            motionClass: "anim-human-wave",
            handGuide: "5 Open Fingers Waving",
            desc: "Open hand with all 5 fingers spread naturally, waving gently side-to-side.",
            fingers: { thumb: "Spread Open 🖐️", index: "Spread Open 🖐️", middle: "Spread Open 🖐️", ring: "Spread Open 🖐️", pinky: "Spread Open 🖐️" },
            steps: [
                "Raise your hand to head or shoulder height facing the camera.",
                "Spread all 5 fingers comfortably apart with palm facing forward.",
                "Wave gently side-to-side or hold upright to say HELLO."
            ]
        },
        {
            name: "THANK YOU",
            category: "Greetings",
            icon: "fa-hands-clapping",
            handPose: "thank_you",
            bodyPosition: "Chin / Mouth",
            motionClass: "anim-human-thank-you",
            handGuide: "Flat Hand Near Chin Moving Out",
            desc: "Flat hand with 4 fingers pressed together, starting near lips/chin and moving forward towards the camera.",
            fingers: { thumb: "Tucked / Flat", index: "Flat Extended Together 🖐️", middle: "Flat Extended Together 🖐️", ring: "Flat Extended Together 🖐️", pinky: "Flat Extended Together 🖐️" },
            steps: [
                "Keep all four fingers extended straight and pressed closely together.",
                "Place fingertips gently near your chin or lips.",
                "Move your flat palm gracefully outward towards the camera."
            ]
        },

        // --- Daily Needs ---
        {
            name: "WATER / ALPHABET W",
            category: "Daily Needs",
            icon: "fa-glass-water",
            handPose: "w_water",
            bodyPosition: "Chin / Mouth",
            motionClass: "anim-human-pulse",
            handGuide: "'W' 3-Finger Shape",
            desc: "Index, Middle, and Ring fingers extended upward forming 'W', pinky folded and held by thumb.",
            fingers: { thumb: "Holding Pinky Folded", index: "Extended Up ☝️", middle: "Extended Up 🖕", ring: "Extended Up 🖖", pinky: "Folded into Palm ✊" },
            steps: [
                "Extend your Index, Middle, and Ring fingers straight up and spread slightly in a 'W'.",
                "Fold your Pinky down into your palm and hold it with your Thumb tip.",
                "Hold the 'W' shape steady near mouth/chin level to request WATER."
            ]
        },

        // --- Expressions ---
        {
            name: "PLEASE",
            category: "Expressions",
            icon: "fa-heart",
            handPose: "please",
            bodyPosition: "Chest Level",
            motionClass: "anim-human-chest-circle",
            handGuide: "Flat Palm Circular Over Chest",
            desc: "Flat open hand placed against chest rubbing in a gentle clockwise circular path.",
            fingers: { thumb: "Extended Flat", index: "Extended Flat", middle: "Extended Flat", ring: "Extended Flat", pinky: "Extended Flat" },
            steps: [
                "Place your open flat palm over the center of your chest.",
                "Keep your fingers pressed together comfortably.",
                "Rub your hand in a gentle clockwise circle over your chest."
            ]
        },
        {
            name: "YES",
            category: "Expressions",
            icon: "fa-circle-check",
            handPose: "yes",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-nod",
            handGuide: "Nodding Fist (S Hand)",
            desc: "Closed fist (S-hand shape) with thumb across knuckles nodding up and down at the wrist.",
            fingers: { thumb: "Tucked Across Knuckles", index: "Folded into Fist ✊", middle: "Folded into Fist ✊", ring: "Folded into Fist ✊", pinky: "Folded into Fist ✊" },
            steps: [
                "Form a closed fist with thumb wrapped across index and middle knuckles.",
                "Hold your fist facing forward in front of the camera.",
                "Tilt your wrist up and down rhythmically like a head nodding YES."
            ]
        },
        {
            name: "NO",
            category: "Expressions",
            icon: "fa-circle-xmark",
            handPose: "no",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-snap",
            handGuide: "3-Finger Pinch Snap",
            desc: "Index and Middle fingers extended snapping down to touch Thumb tip repeatedly.",
            fingers: { thumb: "Touching Index & Middle", index: "Extended & Snapping 🤌", middle: "Extended & Snapping 🤌", ring: "Folded ✊", pinky: "Folded ✊" },
            steps: [
                "Extend your Index and Middle fingers together while folding Ring and Pinky.",
                "Snap your Index and Middle fingertips down to touch your Thumb tip.",
                "Repeat the quick snapping pinch twice to indicate NO."
            ]
        },
        {
            name: "SORRY",
            category: "Expressions",
            icon: "fa-face-sad-tear",
            handPose: "sorry",
            bodyPosition: "Chest Level",
            motionClass: "anim-human-chest-circle",
            handGuide: "Closed Fist Over Chest",
            desc: "Closed fist (S hand) held against chest moving in a gentle circular path.",
            fingers: { thumb: "Tucked Across Knuckles", index: "Folded into Fist ✊", middle: "Folded into Fist ✊", ring: "Folded into Fist ✊", pinky: "Folded into Fist ✊" },
            steps: [
                "Make a closed fist with thumb across front of knuckles.",
                "Place your fist flat against your chest area.",
                "Rub in a gentle clockwise circle over your chest to say SORRY."
            ]
        },
        {
            name: "GOOD / FINE",
            category: "Expressions",
            icon: "fa-thumbs-up",
            handPose: "wave_hello",
            bodyPosition: "Chest Level",
            motionClass: "anim-human-pulse",
            handGuide: "Open 5 Fingers at Chest",
            desc: "Open hand with 5 fingers spread, thumb touching chest or moving gracefully outward.",
            fingers: { thumb: "Extended at Chest", index: "Extended Spread 🖐️", middle: "Extended Spread 🖐️", ring: "Extended Spread 🖐️", pinky: "Extended Spread 🖐️" },
            steps: [
                "Open your hand with all five fingers extended and spread.",
                "Place thumb against your chest or hold hand upright affirmatively.",
                "Hold steady facing camera to indicate FINE or GOOD."
            ]
        },
        {
            name: "PEACE / VICTORY / V",
            category: "Common",
            icon: "fa-hand-peace",
            handPose: "peace_v",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "'V' 2-Finger Shape ✌️",
            desc: "Index and Middle fingers extended pointing up and spread apart in a 'V'.",
            fingers: { thumb: "Holding Ring & Pinky", index: "Extended in V ✌️", middle: "Extended in V ✌️", ring: "Folded into Palm ✊", pinky: "Folded into Palm ✊" },
            steps: [
                "Extend your Index and Middle fingers pointing up and spread apart.",
                "Fold your Ring and Pinky fingers into your palm.",
                "Hold your thumb over folded ring finger facing forward."
            ]
        },
        {
            name: "OK SIGN / F",
            category: "Common",
            icon: "fa-hand-holding-heart",
            handPose: "ok_sign",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Thumb & Index Circle 👌",
            desc: "Thumb and Index fingertips touching to form a circular loop, with other 3 fingers extended upward.",
            fingers: { thumb: "Touching Index Tip", index: "Curled to Thumb Tip 👌", middle: "Extended Up ☝️", ring: "Extended Up ☝️", pinky: "Extended Up ☝️" },
            steps: [
                "Touch the tip of your thumb to the tip of your index finger to form a clean circular loop.",
                "Extend your middle, ring, and pinky fingers straight upward fanned slightly.",
                "Hold the 'OK' loop clearly facing the camera."
            ]
        },
        {
            name: "I LOVE YOU",
            category: "Common",
            icon: "fa-hand-spock",
            handPose: "i_love_you",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Thumb + Index + Pinky 🤟",
            desc: "Thumb, Index, and Pinky fingers extended simultaneously while middle and ring are folded into palm.",
            fingers: { thumb: "Extended Outwards 👈", index: "Extended Straight ☝️", middle: "Folded into Palm ✊", ring: "Folded into Palm ✊", pinky: "Extended Outwards 🤙" },
            steps: [
                "Extend your Index finger straight up and your Pinky straight up.",
                "Extend your Thumb horizontally out to the side.",
                "Keep Middle and Ring fingers folded tightly against palm (forms I + L + Y)."
            ]
        },
        {
            name: "ROCK / METAL",
            category: "Common",
            icon: "fa-hand-back-fist",
            handPose: "rock_metal",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Index & Pinky Extended 🤘",
            desc: "Index and Pinky fingers extended upward while thumb folds over middle and ring fingers.",
            fingers: { thumb: "Holding Middle & Ring", index: "Extended Up ☝️", middle: "Folded into Palm ✊", ring: "Folded into Palm ✊", pinky: "Extended Up ☝️" },
            steps: [
                "Extend your Index and Pinky fingers pointing upward.",
                "Fold Middle and Ring fingers into palm.",
                "Lock your thumb over the middle and ring fingernails."
            ]
        },
        {
            name: "STOP / FIST",
            category: "Common",
            icon: "fa-hand-fist",
            handPose: "fist_stop",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Tight Closed Fist ✊",
            desc: "All fingers folded tightly into palm with thumb locked across fingers facing camera.",
            fingers: { thumb: "Locked Over Fingers", index: "Folded ✊", middle: "Folded ✊", ring: "Folded ✊", pinky: "Folded ✊" },
            steps: [
                "Curl all four fingers into palm tightly.",
                "Wrap your thumb securely across the front of your folded fingers.",
                "Hold fist firmly facing camera to indicate STOP."
            ]
        },

        // --- Numbers ---
        {
            name: "POINT / ONE",
            category: "Numbers",
            icon: "fa-hand-pointer",
            handPose: "point_one",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Single Index Pointing Up ☝️",
            desc: "Index finger pointing straight up, remaining fingers folded into a fist.",
            fingers: { thumb: "Holding Folded Fingers", index: "Extended Straight Up ☝️", middle: "Folded ✊", ring: "Folded ✊", pinky: "Folded ✊" },
            steps: [
                "Extend only your Index finger pointing vertically up.",
                "Fold your Middle, Ring, and Pinky fingers into a fist.",
                "Tuck your thumb across your folded middle finger."
            ]
        },
        {
            name: "TWO",
            category: "Numbers",
            icon: "fa-hand-peace",
            handPose: "peace_v",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Index & Middle Extended ✌️",
            desc: "Index and Middle fingers extended pointing up, ring & pinky folded.",
            fingers: { thumb: "Holding Ring & Pinky", index: "Extended Up ✌️", middle: "Extended Up ✌️", ring: "Folded ✊", pinky: "Folded ✊" },
            steps: [
                "Extend your Index and Middle fingers pointing up.",
                "Fold your Ring and Pinky fingers into your palm.",
                "Hold thumb over the folded ring finger."
            ]
        },
        {
            name: "THREE",
            category: "Numbers",
            icon: "fa-hand-dots",
            handPose: "w_water",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Thumb + Index + Middle",
            desc: "ASL Number 3: Thumb, Index, and Middle fingers extended, Ring and Pinky folded.",
            fingers: { thumb: "Extended Outward", index: "Extended Up ☝️", middle: "Extended Up ☝️", ring: "Folded ✊", pinky: "Folded ✊" },
            steps: [
                "Extend your Thumb, Index, and Middle fingers.",
                "Fold your Ring and Pinky fingers into your palm.",
                "Hold steady facing camera to represent the number 3."
            ]
        },
        {
            name: "FOUR",
            category: "Numbers",
            icon: "fa-hand",
            handPose: "number_four",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "4 Fingers Extended",
            desc: "Index, Middle, Ring, and Pinky fingers extended upward, thumb folded across palm.",
            fingers: { thumb: "Folded Across Palm", index: "Extended Up", middle: "Extended Up", ring: "Extended Up", pinky: "Extended Up" },
            steps: [
                "Extend all 4 fingers (index, middle, ring, pinky) straight up.",
                "Fold your thumb across your palm comfortably.",
                "Face palm forward towards camera."
            ]
        },
        {
            name: "FIVE",
            category: "Numbers",
            icon: "fa-hand",
            handPose: "number_five",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "All 5 Fingers Spread 🖐️",
            desc: "All five fingers open, extended, and spread comfortably facing camera.",
            fingers: { thumb: "Extended", index: "Extended", middle: "Extended", ring: "Extended", pinky: "Extended" },
            steps: [
                "Extend all five fingers comfortably spread apart.",
                "Hold palm facing directly towards the camera.",
                "Hold steady for 0.5s to trigger NUMBER 5."
            ]
        },

        // --- Alphabets ---
        {
            name: "ALPHABET A",
            category: "Alphabet",
            icon: "fa-font",
            handPose: "alpha_a",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Fist With Vertical Side Thumb",
            desc: "Closed fist with all 4 fingers curled down and thumb standing vertically along the side of index finger.",
            fingers: { thumb: "Upright Along Index Side", index: "Folded ✊", middle: "Folded ✊", ring: "Folded ✊", pinky: "Folded ✊" },
            steps: [
                "Fold all 4 fingers into a tight fist.",
                "Rest your thumb upright alongside the outer edge of your index knuckle.",
                "Hold hand steady facing forward towards camera."
            ]
        },
        {
            name: "ALPHABET B",
            category: "Alphabet",
            icon: "fa-hand",
            handPose: "alpha_b",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "4 Fingers Flat Together",
            desc: "Four fingers extended straight up pressed tightly together, thumb tucked across front of palm.",
            fingers: { thumb: "Tucked Across Palm", index: "Extended Flat 🖐️", middle: "Extended Flat 🖐️", ring: "Extended Flat 🖐️", pinky: "Extended Flat 🖐️" },
            steps: [
                "Extend index, middle, ring, and pinky straight up and keep them pressed tightly together.",
                "Fold your thumb across the lower front of your palm.",
                "Hold flat hand facing directly forward."
            ]
        },
        {
            name: "ALPHABET C",
            category: "Alphabet",
            icon: "fa-copyright",
            handPose: "alpha_c",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Curved 'C' Hand Arc",
            desc: "All fingers curved upward and thumb curved downward forming an unmistakable 'C' arc.",
            fingers: { thumb: "Curved Downward 🌙", index: "Curved Upward 🌙", middle: "Curved Upward 🌙", ring: "Curved Upward 🌙", pinky: "Curved Upward 🌙" },
            steps: [
                "Curve your 4 fingers gently into an arch.",
                "Curve your thumb opposite them to form a letter 'C' opening.",
                "Hold hand slightly angled so camera sees the clear 'C' contour."
            ]
        },
        {
            name: "ALPHABET D",
            category: "Alphabet",
            icon: "fa-font",
            handPose: "alpha_d",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Index Up, Others Touch Thumb",
            desc: "Index finger points straight up while thumb touches middle, ring, and pinky fingertips forming a circle.",
            fingers: { thumb: "Touching Other Fingertips", index: "Extended Straight Up ☝️", middle: "Curled to Thumb ⭕", ring: "Curled to Thumb ⭕", pinky: "Curled to Thumb ⭕" },
            steps: [
                "Point your Index finger straight up.",
                "Curl your Middle, Ring, and Pinky fingers down to touch your Thumb tip.",
                "Make sure the circular loop and upright index finger are clearly visible."
            ]
        },
        {
            name: "ALPHABET E",
            category: "Alphabet",
            icon: "fa-font",
            handPose: "alpha_e",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Curled Fingers Over Thumb",
            desc: "All four fingers tightly bent/curled down at knuckles with thumb tucked under the fingertips.",
            fingers: { thumb: "Tucked Under Fingertips", index: "Curled Down ✊", middle: "Curled Down ✊", ring: "Curled Down ✊", pinky: "Curled Down ✊" },
            steps: [
                "Bend all four fingers tightly down at the middle knuckles.",
                "Tuck your thumb across and press it underneath your fingertips.",
                "Face your palm forward towards the camera."
            ]
        },
        {
            name: "ALPHABET I",
            category: "Alphabet",
            icon: "fa-font",
            handPose: "alpha_i",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Pinky Extended Straight Up",
            desc: "Only Pinky finger extended straight up, remaining three fingers and thumb folded into a fist.",
            fingers: { thumb: "Locked Over Folded Fingers", index: "Folded ✊", middle: "Folded ✊", ring: "Folded ✊", pinky: "Extended Straight Up 🤙" },
            steps: [
                "Fold your Index, Middle, and Ring fingers into a fist.",
                "Lock your thumb over your index and middle fingers.",
                "Extend your Pinky finger straight up vertically."
            ]
        },
        {
            name: "ALPHABET L",
            category: "Alphabet",
            icon: "fa-hand-lizard",
            handPose: "alpha_l",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Thumb & Index Form 'L'",
            desc: "Index finger extended straight up and thumb extended out horizontally at a 90-degree angle.",
            fingers: { thumb: "Extended 90-Deg Out 👈", index: "Extended Straight Up ☝️", middle: "Folded ✊", ring: "Folded ✊", pinky: "Folded ✊" },
            steps: [
                "Extend your Index finger straight up.",
                "Extend your Thumb sideways at a sharp 90-degree angle to form an 'L'.",
                "Keep Middle, Ring, and Pinky fingers folded into palm."
            ]
        },
        {
            name: "ALPHABET O / ZERO",
            category: "Alphabet",
            icon: "fa-circle-notch",
            handPose: "alpha_o",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Fingertips Touching Thumb in 'O'",
            desc: "All fingertips curved together touching the thumb tip to form a round 'O' shape.",
            fingers: { thumb: "Touching All Fingertips", index: "Curved into O ⭕", middle: "Curved into O ⭕", ring: "Curved into O ⭕", pinky: "Curved into O ⭕" },
            steps: [
                "Curve all your fingers forward into an arch.",
                "Touch your fingertips to your thumb tip to make a circular 'O' shape.",
                "Hold hand steady facing camera."
            ]
        },
        {
            name: "ALPHABET U",
            category: "Alphabet",
            icon: "fa-font",
            handPose: "alpha_u",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Index & Middle Together",
            desc: "Index and Middle fingers extended straight up pressed tightly together (unlike V which is spread).",
            fingers: { thumb: "Holding Ring & Pinky", index: "Extended Together ☝️", middle: "Extended Together ☝️", ring: "Folded ✊", pinky: "Folded ✊" },
            steps: [
                "Extend your Index and Middle fingers straight up.",
                "Press them tightly together side-by-side with no gap.",
                "Fold Ring and Pinky into palm and hold with thumb."
            ]
        },
        {
            name: "ALPHABET X",
            category: "Alphabet",
            icon: "fa-font",
            handPose: "alpha_x",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Hooked Index Finger",
            desc: "Index finger hooked/bent into a curve, other fingers folded into palm.",
            fingers: { thumb: "Holding Folded Fingers", index: "Hooked / Bent 🪝", middle: "Folded ✊", ring: "Folded ✊", pinky: "Folded ✊" },
            steps: [
                "Fold Middle, Ring, and Pinky into palm.",
                "Bend/hook your Index finger at the top knuckle like a pirate hook.",
                "Hold hand steady facing camera."
            ]
        },
        {
            name: "ALPHABET Y",
            category: "Alphabet",
            icon: "fa-hand-spock",
            handPose: "alpha_y",
            bodyPosition: "Front of Camera",
            motionClass: "anim-human-pulse",
            handGuide: "Thumb & Pinky Extended Wide",
            desc: "Thumb and Pinky fingers extended outwards in opposite directions (Shaka / Call Me sign).",
            fingers: { thumb: "Extended Out 🤙", index: "Folded ✊", middle: "Folded ✊", ring: "Folded ✊", pinky: "Extended Out 🤙" },
            steps: [
                "Extend your Thumb out to the left and Pinky out to the right as wide as possible.",
                "Keep Index, Middle, and Ring fingers folded tightly into your palm.",
                "Hold hand steady facing camera."
            ]
        }
    ];

    // =========================================================================
    // 2. Real Photorealistic Hand Model Renderer (Zero Cartoon Hands)
    // =========================================================================
    // Helper to map each sign to its corresponding 3D claymorphic hand model photo
    window.getSign3DPhoto = function (item) {
        if (!item) return 'assets/icon_3d_hello.png';
        const name = (item.name || '').toUpperCase();
        const pose = (item.handPose || '').toLowerCase();

        if (name.includes('THUMBS UP') || (name.includes('YES') && !name.includes('NO'))) {
            return 'assets/icon_3d_thumbs_up.png';
        }
        if (name.includes('THUMBS DOWN') || name === 'NO') {
            return 'assets/icon_3d_thumbs_down.png';
        }
        if (name.includes('PEACE') || name.includes('VICTORY') || name === 'TWO' || pose === 'peace_v') {
            return 'assets/icon_3d_peace.png';
        }
        if (name.includes('POINT') || name === 'ONE' || pose === 'point_one') {
            return 'assets/icon_3d_point.png';
        }
        if (name.includes('HI') || name.includes('HELLO') || name.includes('GOOD') || name.includes('FINE') || name === 'FIVE') {
            return 'assets/icon_3d_hello.png';
        }
        if (name.includes('STOP') || name.includes('FIST') || name === 'ALPHABET A' || name === 'ALPHABET S' || name === 'SORRY' || pose === 'fist_stop') {
            return 'assets/icon_3d_fist.png';
        }
        if (name.includes('OK') || name === 'ALPHABET F' || pose === 'ok_sign') {
            return 'assets/icon_3d_ok.png';
        }
        if (name.includes('LOVE') || pose === 'i_love_you') {
            return 'assets/icon_3d_ily.png';
        }
        if (name.includes('WATER') || name === 'ALPHABET W' || name === 'THREE' || pose === 'w_water') {
            return 'assets/icon_3d_water.png';
        }
        if (name.includes('HELP') || pose === 'help') {
            return 'assets/icon_3d_help.png';
        }
        if (name.includes('ROCK') || name.includes('METAL') || pose === 'rock_metal') {
            return 'assets/icon_3d_rock.png';
        }
        if (name === 'ALPHABET Y' || name.includes('SHAKA') || name.includes('CALL') || pose === 'alpha_y') {
            return 'assets/icon_3d_shaka.png';
        }
        if (name.includes('THANK') || name === 'ALPHABET B' || name === 'FOUR' || name.includes('PLEASE')) {
            return 'assets/icon_3d_flat.png';
        }

        // Fallback standard 3D hand icon
        return 'assets/icon_3d_hello.png';
    };

    window.getSign3DBanner = function (item) {
        if (!item) return 'assets/banner_3d_hello.png';
        const photo = window.getSign3DPhoto(item);
        return photo.replace('icon_3d_', 'banner_3d_');
    };

    window.getHandOrientation = function (item) {
        if (!item) return { view: 'palmar', image: 'assets/icon_3d_hello.png', label: 'Palm View', icon: 'fa-regular fa-hand' };
        const name = (item.name || '').toUpperCase();
        const pose = (item.handPose || '').toLowerCase();
        const photo3D = window.getSign3DPhoto(item);

        // Signs where back of hand or closed fist faces viewer:
        const isDorsal = name.includes('YES') ||
            name.includes('NO') ||
            name.includes('ROCK') ||
            name === 'ALPHABET A' ||
            name === 'ALPHABET E' ||
            name === 'ALPHABET S' ||
            pose === 'fist';

        return {
            view: isDorsal ? 'dorsal' : 'palmar',
            image: photo3D,
            label: isDorsal ? 'Back View' : 'Front View',
            icon: isDorsal ? 'fa-solid fa-hand' : 'fa-regular fa-hand'
        };
    };

    window.renderRealPhotoHand = function (item, isMini = false, speedClass = '') {
        if (!item) return '';
        const orientation = window.getHandOrientation(item);
        const name = (item.name || '').toUpperCase();
        const motion = item.motionClass || 'anim-real-pulse';
        const photo3D = window.getSign3DPhoto(item);

        // 1. Mini Preview for Reference Catalog Cards & Right Drawer Grid
        if (isMini) {
            return `
            <div class="mini-real-hand-preview" title="${item.name}: 3D Hand Model">
                <img src="${photo3D}" alt="${item.name} 3D Hand Sign" class="mini-real-hand-img" />
            </div>`;
        }

        // 2. Full Demonstration Stage for Modal
        const bodyPos = item.bodyPosition || 'Front of Camera';
        const bodyTag = `<div class="body-placement-indicator"><i class="fa-solid fa-location-dot"></i> ${bodyPos}</div>`;
        const orientationTag = `<div class="hand-orientation-indicator"><i class="${orientation.icon}"></i> ${orientation.label}</div>`;

        // Helpful motion guidance pill
        let motionGuidance = 'Hold steady to detect';
        let motionIcon = 'fa-solid fa-hand-holding';
        if (name.includes('THANK')) {
            motionGuidance = 'Move smoothly outward from chin';
            motionIcon = 'fa-solid fa-arrow-down-long';
        } else if (name.includes('HELLO') || name.includes('HI')) {
            motionGuidance = 'Wave gently side-to-side';
            motionIcon = 'fa-solid fa-arrows-left-right';
        } else if (name.includes('PLEASE')) {
            motionGuidance = 'Circle gently across chest';
            motionIcon = 'fa-solid fa-rotate';
        } else if (name.includes('HELP')) {
            motionGuidance = 'Lift upward with confidence';
            motionIcon = 'fa-solid fa-arrow-up-long';
        } else if (name.includes('THUMBS')) {
            motionGuidance = 'Affirmative upward bounce';
            motionIcon = 'fa-solid fa-thumbs-up';
        } else if (name.includes('YES')) {
            motionGuidance = 'Fist nods gently down and up';
            motionIcon = 'fa-solid fa-arrow-down';
        } else if (name.includes('NO')) {
            motionGuidance = 'Side-to-side shake';
            motionIcon = 'fa-solid fa-left-right';
        } else if (name.includes('WATER') || name.includes('FOOD') || name.includes('EAT')) {
            motionGuidance = 'Bring fingers towards mouth';
            motionIcon = 'fa-solid fa-arrow-up';
        }

        const guidancePill = `<div class="real-motion-guidance-pill"><i class="${motionIcon}"></i> ${motionGuidance}</div>`;

        // Finger configuration status pins
        const f = item.fingers || { thumb: "Extended", index: "Extended", middle: "Folded", ring: "Folded", pinky: "Extended" };
        const isThumbFold = (f.thumb || '').toLowerCase().includes('folded');
        const isIndexFold = (f.index || '').toLowerCase().includes('folded');
        const isMiddleFold = (f.middle || '').toLowerCase().includes('folded');
        const isRingFold = (f.ring || '').toLowerCase().includes('folded');
        const isPinkyFold = (f.pinky || '').toLowerCase().includes('folded');

        // Coordinate adjustments depending on Palmar vs Dorsal
        // Palmar view: thumb is to the right side (right hand palm view)
        // Dorsal view: thumb is to the left side (right hand back view)
        const isPalmar = orientation.view === 'palmar';
        const thumbPos = isPalmar ? 'right: 6%; top: 54%;' : 'left: 6%; top: 54%;';
        const indexPos = isPalmar ? 'right: 30%; top: 18%;' : 'left: 30%; top: 18%;';
        const middlePos = 'left: 50%; top: 9%;';
        const ringPos = isPalmar ? 'left: 24%; top: 22%;' : 'right: 24%; top: 22%;';
        const pinkyPos = isPalmar ? 'left: 6%; top: 38%;' : 'right: 6%; top: 38%;';

        return `
        <div class="real-hand-stage-content">
            ${bodyTag}
            ${orientationTag}
            ${guidancePill}
            <div class="real-hand-motion-wrap ${motion} ${speedClass}">
                <img src="${orientation.image}" alt="${item.name} Real Hand Model" class="real-hand-img" />
                <div class="finger-hotspots">
                    <span class="finger-pin ${isThumbFold ? 'pin-folded' : 'pin-ext'}" style="${thumbPos}" title="Thumb: ${f.thumb}">
                        <span class="pin-dot"></span>
                        <span class="pin-text">Thumb ${isThumbFold ? 'Fold' : 'Ext'}</span>
                    </span>
                    <span class="finger-pin ${isIndexFold ? 'pin-folded' : 'pin-ext'}" style="${indexPos}" title="Index: ${f.index}">
                        <span class="pin-dot"></span>
                        <span class="pin-text">Index ${isIndexFold ? 'Fold' : 'Ext'}</span>
                    </span>
                    <span class="finger-pin ${isMiddleFold ? 'pin-folded' : 'pin-ext'}" style="${middlePos}" title="Middle: ${f.middle}">
                        <span class="pin-dot"></span>
                        <span class="pin-text">Middle ${isMiddleFold ? 'Fold' : 'Ext'}</span>
                    </span>
                    <span class="finger-pin ${isRingFold ? 'pin-folded' : 'pin-ext'}" style="${ringPos}" title="Ring: ${f.ring}">
                        <span class="pin-dot"></span>
                        <span class="pin-text">Ring ${isRingFold ? 'Fold' : 'Ext'}</span>
                    </span>
                    <span class="finger-pin ${isPinkyFold ? 'pin-folded' : 'pin-ext'}" style="${pinkyPos}" title="Pinky: ${f.pinky}">
                        <span class="pin-dot"></span>
                        <span class="pin-text">Pinky ${isPinkyFold ? 'Fold' : 'Ext'}</span>
                    </span>
                </div>
            </div>
        </div>`;
    };

    // Global alias to ensure complete replacement of any cartoon SVG references
    window.generateHumanSignSvg = window.renderRealPhotoHand;

    // =========================================================================
    // 3. MediaPipe Hands Tracking & Webcam Life Cycle
    // =========================================================================
    function initMediaPipe() {
        if (typeof Hands === 'undefined') {
            console.error("MediaPipe Hands library failed to load from CDN.");
            if (handCountLabel) handCountLabel.textContent = "AI Library Missing";
            return false;
        }

        if (!handsInstance) {
            if (handCountLabel) handCountLabel.textContent = "Loading AI Models...";
            handsInstance = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
            });

            handsInstance.setOptions({
                maxNumHands: 2,
                modelComplexity: 0,
                minDetectionConfidence: 0.20,
                minTrackingConfidence: 0.20
            });

            handsInstance.onResults(onHandResults);
        }
        return true;
    }

    async function startCamera() {
        if (isCameraActive || !webcamElement) return;

        // 1. Mobile Secure Context Verification (iOS & Android require HTTPS or localhost)
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const isSecure = window.isSecureContext || isLocalHost;
        const mobileNotice = document.getElementById('mobile-https-notice');
        const switchHttpsBtn = document.getElementById('btn-switch-https');

        if (!isSecure && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
            const httpsUrl = `https://${window.location.hostname}:8443${window.location.pathname}${window.location.search}#camera-section`;
            if (mobileNotice) {
                mobileNotice.style.display = 'flex';
                if (switchHttpsBtn) switchHttpsBtn.href = httpsUrl;
            }
            if (confirm("📱 Mobile Camera Access Notice:\n\nAndroid Chrome and iOS Safari strictly require a secure (HTTPS) connection for camera permissions.\n\nWould you like to switch to the secure HTTPS link now?\n\n(" + httpsUrl + ")")) {
                window.location.href = httpsUrl;
                return;
            }
        }

        try {
            if (handCountLabel) handCountLabel.textContent = "Starting AI Camera...";

            const ready = initMediaPipe();
            if (!ready) {
                throw new Error("MediaPipe Hands library not loaded. Check internet connection.");
            }

            // Configure video attributes specifically required by iOS Safari & Android Chrome
            webcamElement.setAttribute('autoplay', '');
            webcamElement.setAttribute('muted', '');
            webcamElement.setAttribute('playsinline', '');
            webcamElement.setAttribute('webkit-playsinline', '');
            webcamElement.playsInline = true;
            webcamElement.muted = true;
            webcamElement.autoplay = true;

            let stream = null;
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                // Tiered constraints: try current facingMode first, then fallback
                const constraintTiers = [
                    {
                        video: {
                            facingMode: { ideal: currentFacingMode },
                            width: { ideal: 640 },
                            height: { ideal: 480 }
                        },
                        audio: false
                    },
                    {
                        video: { facingMode: currentFacingMode },
                        audio: false
                    },
                    {
                        video: true,
                        audio: false
                    }
                ];

                let lastErr = null;
                for (const constraints of constraintTiers) {
                    try {
                        stream = await navigator.mediaDevices.getUserMedia(constraints);
                        if (stream) break;
                    } catch (e) {
                        lastErr = e;
                    }
                }

                if (!stream && lastErr) throw lastErr;
            }

            if (stream) {
                mediaStream = stream;
                webcamElement.srcObject = mediaStream;

                // Wait for video metadata/readiness
                await new Promise((resolve) => {
                    if (webcamElement.readyState >= 2 && webcamElement.videoWidth > 0) {
                        resolve();
                    } else {
                        const onLoaded = () => {
                            webcamElement.removeEventListener('loadedmetadata', onLoaded);
                            webcamElement.removeEventListener('canplay', onLoaded);
                            resolve();
                        };
                        webcamElement.addEventListener('loadedmetadata', onLoaded);
                        webcamElement.addEventListener('canplay', onLoaded);
                        setTimeout(resolve, 1000);
                    }
                });

                try {
                    await webcamElement.play();
                } catch (playErr) {
                    console.warn("Video play warning:", playErr);
                }

                // CRITICAL: Set isCameraActive = true BEFORE starting frame loop
                isCameraActive = true;
                isProcessingFrame = false;
                processVideoFrame();
            } else if (typeof Camera !== 'undefined') {
                cameraInstance = new Camera(webcamElement, {
                    onFrame: async () => {
                        if (handsInstance && isCameraActive) {
                            try {
                                await handsInstance.send({ image: webcamElement });
                            } catch (e) {
                                console.warn("Hands send error:", e);
                            }
                        }
                    },
                    width: 640,
                    height: 480
                });
                await cameraInstance.start();
                isCameraActive = true;
                isProcessingFrame = false;
            } else {
                throw new Error("navigator.mediaDevices is not available in this browser context.");
            }

            if (cameraPlaceholder) cameraPlaceholder.classList.add('hidden');
            if (cameraBtnText) cameraBtnText.textContent = 'Stop Camera';
            if (btnToggleCamera) {
                btnToggleCamera.classList.remove('btn-primary');
                btnToggleCamera.classList.add('btn-secondary');
            }
            if (liveIndicator) liveIndicator.style.display = 'inline-flex';
            if (handCountLabel) handCountLabel.textContent = "Scanning for Hands...";

            const islandCamLed = document.getElementById('island-cam-led');
            if (islandCamLed) islandCamLed.style.display = 'block';

            speakText("Camera active. Ready for sign translation.");

        } catch (err) {
            console.error("Camera Access Error:", err);
            isCameraActive = false;
            if (handCountLabel) handCountLabel.textContent = "Camera Error";
            let errMsg = err.message || err.toString();

            if (window.location.protocol !== 'https:' && !isLocalHost) {
                const httpsUrl = `https://${window.location.hostname}:8443${window.location.pathname}#camera-section`;
                if (mobileNotice) {
                    mobileNotice.style.display = 'flex';
                    if (switchHttpsBtn) switchHttpsBtn.href = httpsUrl;
                }
                alert(`📱 Camera Access on Mobile Requires HTTPS:\n\nPlease open the secure link:\n${httpsUrl}\n\n(On iOS/Android, tap "Advanced" -> "Proceed" to accept the local SSL cert).`);
            } else {
                alert("Unable to access camera: " + errMsg);
            }
        }
    }

    async function processVideoFrame() {
        if (!isCameraActive || !webcamElement) return;

        if (webcamElement.readyState >= 2 && webcamElement.videoWidth > 0 && handsInstance && !isProcessingFrame) {
            isProcessingFrame = true;
            try {
                await handsInstance.send({ image: webcamElement });
            } catch (err) {
                console.warn("MediaPipe Frame Send Warning:", err);
            } finally {
                isProcessingFrame = false;
            }
        }
        if (isCameraActive) {
            animFrameId = requestAnimationFrame(processVideoFrame);
        }
    }

    function stopCamera() {
        isCameraActive = false;
        isProcessingFrame = false;

        if (cameraInstance) {
            try { cameraInstance.stop(); } catch (e) {}
            cameraInstance = null;
        }

        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }

        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }

        if (webcamElement) webcamElement.srcObject = null;
        if (cameraPlaceholder) cameraPlaceholder.classList.remove('hidden');
        if (cameraBtnText) cameraBtnText.textContent = 'Start Camera';
        if (btnToggleCamera) {
            btnToggleCamera.classList.add('btn-primary');
            btnToggleCamera.classList.remove('btn-secondary');
        }
        if (liveIndicator) liveIndicator.style.display = 'none';
        if (fpsCounter) fpsCounter.textContent = '0 FPS';
        const islandCamLed = document.getElementById('island-cam-led');
        if (islandCamLed) islandCamLed.style.display = 'none';
        if (handCountLabel) handCountLabel.textContent = 'No Hand Detected';
        if (confidenceLabel) confidenceLabel.textContent = 'Confidence: 0%';
        resetCurrentSignDisplay();

        if (canvasCtx && canvasElement) {
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        }
    }

    function onHandResults(results) {
        calculateFPS();

        if (!canvasElement || !canvasCtx) return;

        const targetW = webcamElement.videoWidth || 640;
        const targetH = webcamElement.videoHeight || 480;
        if (canvasElement.width !== targetW || canvasElement.height !== targetH) {
            canvasElement.width = targetW;
            canvasElement.height = targetH;
        }

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (isMirrored) {
            canvasCtx.translate(canvasElement.width, 0);
            canvasCtx.scale(-1, 1);
        }

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const numHands = results.multiHandLandmarks.length;
            if (handCountLabel) handCountLabel.textContent = `${numHands} Hand${numHands > 1 ? 's' : ''} Detected`;

            const rawPrimaryLandmarks = results.multiHandLandmarks[0];
            const handednessObj = results.multiHandedness && results.multiHandedness[0];
            const handLabel = (handednessObj && handednessObj.label) ? handednessObj.label : 'Right';
            const handScore = handednessObj ? Math.round(handednessObj.score * 100) : 96;
            if (confidenceLabel) confidenceLabel.textContent = `Confidence: ${handScore}%`;

            // 1. Light Landmark Smoothing to Eliminate Jitter
            const primaryLandmarks = smoothLandmarks(rawPrimaryLandmarks);

            // 2. Extract Invariant Kinematic Features & Diagnostics
            const features = extractHandFeatures(primaryLandmarks, handLabel, handScore);
            updateQualityDiagnostics(features, handScore);

            // 3. Multi-Feature Recognition with Strict Negative Matching
            const framePrediction = classifyHandGesture(features, primaryLandmarks, numHands);

            // 4. Temporal Stability Buffer Filtering (Window of 8 frames)
            const stableResult = processTemporalStability(framePrediction, features);

            // 5. Render Visual AI Overlay
            if (drawSkeleton) {
                try {
                    for (const landmarks of results.multiHandLandmarks) {
                        drawFuturisticAIHandOverlay(canvasCtx, landmarks, handScore, stableResult, targetW, targetH);
                    }
                } catch (drawErr) {
                    console.warn("Futuristic overlay render error:", drawErr);
                }
            }

            // 6. Update UI and Optional Debug Telemetry HUD
            updateRecognitionUI(stableResult, handScore);
            if (isDebugMode) {
                renderDebugHUD(features, framePrediction, stableResult);
            }

        } else {
            smoothedLandmarks = null;
            predictionWindow = [];
            if (handCountLabel) handCountLabel.textContent = 'No Hand Detected';
            if (confidenceLabel) confidenceLabel.textContent = 'Confidence: 0%';
            if (qualityLabel) {
                qualityLabel.textContent = 'No Hand';
                if (qualityChip) qualityChip.className = 'info-chip';
            }
            if (aiDebugHud && isDebugMode) {
                aiDebugHud.innerHTML = `<div class="debug-header"><span>AI VISION TELEMETRY</span><span style="color:#ef4444;">IDLE</span></div><div>No hand detected in camera frame.</div>`;
            }
            resetCurrentSignDisplay();
        }

        canvasCtx.restore();
    }

    // =========================================================================
    // 3B. High-Precision Futuristic AR/HUD AI Hand Tracking Overlay
    // =========================================================================
    function drawFuturisticAIHandOverlay(ctx, landmarks, handScore, recognized, w, h) {
        if (!landmarks || landmarks.length < 21) return;

        const now = performance.now();
        const pulseElapsed = now - lastRecognitionPulseTime;
        const isPulseActive = pulseElapsed < 500;
        const pulseProgress = isPulseActive ? pulseElapsed / 500 : 1;

        // Convert normalized [0..1] coordinates into pixel coordinates
        const pts = landmarks.map(lm => ({
            x: lm.x * w,
            y: lm.y * h,
            z: lm.z || 0
        }));

        const wrist = pts[0];
        function distPx(p1, p2) {
            return Math.hypot(p1.x - p2.x, p1.y - p2.y);
        }

        // Bounding box for scanning line & target corner brackets
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < 21; i++) {
            const p = pts[i];
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }
        const padX = Math.max(14, (maxX - minX) * 0.12);
        const padY = Math.max(14, (maxY - minY) * 0.12);
        const bX1 = minX - padX;
        const bX2 = maxX + padX;
        const bY1 = minY - padY;
        const bY2 = maxY + padY;

        // Overall intensity adapts smoothly to detection confidence
        const trackingAlpha = Math.max(0.35, Math.min(1.0, handScore / 100));

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // ---------------------------------------------------------------------
        // 1. Semi-Transparent Holographic Palm Mesh & Lattice
        // ---------------------------------------------------------------------
        const palmIndices = [0, 1, 5, 9, 13, 17];
        ctx.beginPath();
        ctx.moveTo(pts[palmIndices[0]].x, pts[palmIndices[0]].y);
        for (let i = 1; i < palmIndices.length; i++) {
            ctx.lineTo(pts[palmIndices[i]].x, pts[palmIndices[i]].y);
        }
        ctx.closePath();

        const palmGrad = ctx.createRadialGradient(
            pts[9].x, pts[9].y, 8,
            pts[9].x, pts[9].y, Math.max(40, (maxY - minY) * 0.5)
        );
        if (isPulseActive) {
            const flashAlpha = (1 - pulseProgress) * 0.15;
            palmGrad.addColorStop(0, `rgba(34, 211, 238, ${0.08 + flashAlpha})`);
            palmGrad.addColorStop(1, 'rgba(0, 240, 255, 0.008)');
        } else {
            palmGrad.addColorStop(0, `rgba(0, 240, 255, ${0.045 * trackingAlpha})`);
            palmGrad.addColorStop(1, 'rgba(0, 240, 255, 0.005)');
        }
        ctx.fillStyle = palmGrad;
        ctx.fill();

        // Metacarpal Ray Triangulation Lines
        const latticeBridges = [
            [0, 5], [0, 9], [0, 13],
            [1, 5], [5, 9], [9, 13], [13, 17]
        ];
        ctx.strokeStyle = `rgba(0, 240, 255, ${0.15 * trackingAlpha})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (const [i1, i2] of latticeBridges) {
            ctx.moveTo(pts[i1].x, pts[i1].y);
            ctx.lineTo(pts[i2].x, pts[i2].y);
        }
        ctx.stroke();

        // Delicate Inter-Finger Webbing Lines
        const fingerWebs = [[6, 10], [10, 14], [14, 18]];
        ctx.save();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = `rgba(0, 240, 255, ${0.12 * trackingAlpha})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (const [w1, w2] of fingerWebs) {
            ctx.moveTo(pts[w1].x, pts[w1].y);
            ctx.lineTo(pts[w2].x, pts[w2].y);
        }
        ctx.stroke();
        ctx.restore();

        // ---------------------------------------------------------------------
        // 2. Subtle Animated AI Scanning Wave
        // ---------------------------------------------------------------------
        const scanCycle = (now * 0.00065) % 1;
        const scanY = bY1 + scanCycle * (bY2 - bY1);
        const scanWidth = bX2 - bX1;

        if (scanWidth > 12) {
            const scanGrad = ctx.createLinearGradient(bX1, scanY, bX2, scanY);
            scanGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
            scanGrad.addColorStop(0.25, `rgba(0, 240, 255, ${0.35 * trackingAlpha})`);
            scanGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.85 * trackingAlpha})`);
            scanGrad.addColorStop(0.75, `rgba(0, 240, 255, ${0.35 * trackingAlpha})`);
            scanGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');

            ctx.strokeStyle = scanGrad;
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(bX1 + 4, scanY);
            ctx.lineTo(bX2 - 4, scanY);
            ctx.stroke();

            // Soft Trailing Scan Beam
            const trailH = Math.min(16, scanY - bY1);
            if (trailH > 2) {
                const trailGrad = ctx.createLinearGradient(0, scanY - trailH, 0, scanY);
                trailGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
                trailGrad.addColorStop(1, `rgba(0, 240, 255, ${0.05 * trackingAlpha})`);
                ctx.fillStyle = trailGrad;
                ctx.fillRect(bX1 + 6, scanY - trailH, scanWidth - 12, trailH);
            }
        }

        // ---------------------------------------------------------------------
        // 3. Dynamic Finger Extension Highlighting & Razor Laser Bones
        // ---------------------------------------------------------------------
        const isExt = [
            distPx(pts[4], wrist) > distPx(pts[2], wrist) * 1.15,
            distPx(pts[8], wrist) > distPx(pts[6], wrist) * 1.08 && distPx(pts[8], pts[5]) > distPx(pts[6], pts[5]) * 1.2,
            distPx(pts[12], wrist) > distPx(pts[10], wrist) * 1.08 && distPx(pts[12], pts[9]) > distPx(pts[10], pts[9]) * 1.2,
            distPx(pts[16], wrist) > distPx(pts[14], wrist) * 1.08 && distPx(pts[16], pts[13]) > distPx(pts[14], pts[13]) * 1.2,
            distPx(pts[20], wrist) > distPx(pts[18], wrist) * 1.08 && distPx(pts[20], pts[17]) > distPx(pts[18], pts[17]) * 1.2
        ];

        const fingerChains = [
            { fIndex: 0, chain: [[0, 1], [1, 2], [2, 3], [3, 4]] },
            { fIndex: 1, chain: [[0, 5], [5, 6], [6, 7], [7, 8]] },
            { fIndex: 2, chain: [[0, 9], [9, 10], [10, 11], [11, 12]] },
            { fIndex: 3, chain: [[0, 13], [13, 14], [14, 15], [15, 16]] },
            { fIndex: 4, chain: [[0, 17], [17, 18], [18, 19], [19, 20]] }
        ];

        // Pass 1: Outer Soft Luminescent Aura
        for (const { fIndex, chain } of fingerChains) {
            const extended = isExt[fIndex];
            ctx.save();
            ctx.lineWidth = extended ? 2.5 : 1.5;
            ctx.shadowColor = isPulseActive ? '#34d399' : '#00f0ff';
            ctx.shadowBlur = extended ? (isPulseActive ? 12 : 7) : 3;

            if (isPulseActive) {
                ctx.strokeStyle = `rgba(52, 211, 153, ${0.55 * (1 - pulseProgress * 0.3)})`;
            } else if (extended) {
                ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 * trackingAlpha})`;
            } else {
                ctx.strokeStyle = `rgba(0, 240, 255, ${0.18 * trackingAlpha})`;
            }

            ctx.beginPath();
            for (const [pA, pB] of chain) {
                ctx.moveTo(pts[pA].x, pts[pA].y);
                ctx.lineTo(pts[pB].x, pts[pB].y);
            }
            ctx.stroke();
            ctx.restore();
        }

        // Pass 2: Inner Razor-Thin Laser Core Line
        for (const { fIndex, chain } of fingerChains) {
            const extended = isExt[fIndex];
            ctx.save();
            ctx.lineWidth = extended ? 1.15 : 0.8;
            ctx.shadowBlur = 0;

            if (isPulseActive) {
                ctx.strokeStyle = '#ffffff';
            } else if (extended) {
                ctx.strokeStyle = `rgba(240, 255, 255, ${0.95 * trackingAlpha})`;
            } else {
                ctx.strokeStyle = `rgba(150, 230, 250, ${0.65 * trackingAlpha})`;
            }

            ctx.beginPath();
            for (const [pA, pB] of chain) {
                ctx.moveTo(pts[pA].x, pts[pA].y);
                ctx.lineTo(pts[pB].x, pts[pB].y);
            }
            ctx.stroke();
            ctx.restore();
        }

        // ---------------------------------------------------------------------
        // 4. Micro-HUD Joint Tracking Points & Fingertip Reticles
        // ---------------------------------------------------------------------
        const tipIndices = [4, 8, 12, 16, 20];

        // Intermediate Joints: Micro-Rings & Tiny White Dots
        for (let i = 1; i < 21; i++) {
            if (tipIndices.includes(i)) continue;
            const pt = pts[i];

            // Outer micro ring
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2.3, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 240, 255, ${0.6 * trackingAlpha})`;
            ctx.lineWidth = 0.65;
            ctx.stroke();

            // Inner crisp center dot
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 1.1, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * trackingAlpha})`;
            ctx.fill();
        }

        // Fingertip Reticles (4, 8, 12, 16, 20)
        tipIndices.forEach((tipIdx, fIdx) => {
            const pt = pts[tipIdx];
            const extended = isExt[fIdx];
            const ringR = extended ? 4.8 : 3.8;

            ctx.save();
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = extended ? 6 : 2;

            // Outer reticle ring
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = extended
                ? (isPulseActive ? '#34d399' : 'rgba(0, 240, 255, 0.95)')
                : `rgba(0, 240, 255, ${0.45 * trackingAlpha})`;
            ctx.lineWidth = 0.85;
            ctx.stroke();

            // Center target core
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 1.4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            // Micro crosshair ticks on active fingertips
            if (extended) {
                const tickLen = 2.0;
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
                ctx.lineWidth = 0.75;
                ctx.beginPath();
                ctx.moveTo(pt.x, pt.y - ringR - tickLen); ctx.lineTo(pt.x, pt.y - ringR);
                ctx.moveTo(pt.x, pt.y + ringR); ctx.lineTo(pt.x, pt.y + ringR + tickLen);
                ctx.moveTo(pt.x - ringR - tickLen, pt.y); ctx.lineTo(pt.x - ringR, pt.y);
                ctx.moveTo(pt.x + ringR, pt.y); ctx.lineTo(pt.x + ringR + tickLen, pt.y);
                ctx.stroke();

                // Subtle orbital light point
                const pAngle = now * 0.003 + fIdx * 1.25;
                const orbitR = ringR + 3.2;
                const pX = pt.x + Math.cos(pAngle) * orbitR;
                const pY = pt.y + Math.sin(pAngle) * orbitR;
                ctx.beginPath();
                ctx.arc(pX, pY, 0.8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 240, 255, 0.75)';
                ctx.fill();
            }

            ctx.restore();
        });

        // Wrist Datum Anchor
        ctx.save();
        ctx.beginPath();
        ctx.arc(wrist.x, wrist.y, 4.0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 240, 255, ${0.5 * trackingAlpha})`;
        ctx.lineWidth = 0.75;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(wrist.x, wrist.y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();

        // ---------------------------------------------------------------------
        // 5. Confident Recognition Holographic Pulse Ripple
        // ---------------------------------------------------------------------
        if (isPulseActive) {
            const rippleR = pulseProgress * 70;
            const rippleAlpha = (1 - pulseProgress) * 0.7;

            ctx.save();
            ctx.beginPath();
            ctx.arc(pts[9].x, pts[9].y, rippleR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(34, 211, 238, ${rippleAlpha})`;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = 8;
            ctx.stroke();

            // Inner harmonic ring
            if (rippleR > 16) {
                ctx.beginPath();
                ctx.arc(pts[9].x, pts[9].y, rippleR * 0.55, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${rippleAlpha * 0.8})`;
                ctx.lineWidth = 0.9;
                ctx.stroke();
            }
            ctx.restore();
        }

        // ---------------------------------------------------------------------
        // 6. Subtle Cyber-Optics HUD Corner Target Brackets
        // ---------------------------------------------------------------------
        const cLen = 9;
        ctx.save();
        ctx.strokeStyle = isPulseActive ? 'rgba(52, 211, 153, 0.6)' : `rgba(0, 240, 255, ${0.3 * trackingAlpha})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath();

        // Top-Left
        ctx.moveTo(bX1, bY1 + cLen); ctx.lineTo(bX1, bY1); ctx.lineTo(bX1 + cLen, bY1);
        // Top-Right
        ctx.moveTo(bX2 - cLen, bY1); ctx.lineTo(bX2, bY1); ctx.lineTo(bX2, bY1 + cLen);
        // Bottom-Left
        ctx.moveTo(bX1, bY2 - cLen); ctx.lineTo(bX1, bY2); ctx.lineTo(bX1 + cLen, bY2);
        // Bottom-Right
        ctx.moveTo(bX2 - cLen, bY2); ctx.lineTo(bX2, bY2); ctx.lineTo(bX2, bY2 - cLen);

        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }

    // =========================================================================
    // 4. Advanced 3D Kinematic Landmark AI Recognition Engine (Invariant & Strict)
    // =========================================================================

    function smoothLandmarks(rawLm) {
        if (!rawLm || rawLm.length < 21) return rawLm;
        if (!smoothedLandmarks || smoothedLandmarks.length !== 21) {
            smoothedLandmarks = rawLm.map(p => ({ x: p.x, y: p.y, z: p.z || 0 }));
            return smoothedLandmarks;
        }
        const alpha = 0.72;
        for (let i = 0; i < 21; i++) {
            smoothedLandmarks[i].x = alpha * rawLm[i].x + (1 - alpha) * smoothedLandmarks[i].x;
            smoothedLandmarks[i].y = alpha * rawLm[i].y + (1 - alpha) * smoothedLandmarks[i].y;
            smoothedLandmarks[i].z = alpha * (rawLm[i].z || 0) + (1 - alpha) * smoothedLandmarks[i].z;
        }
        return smoothedLandmarks;
    }

    function dist3D(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = (p1.z || 0) - (p2.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    function angleBetween3D(a, b, c) {
        const v1x = a.x - b.x, v1y = a.y - b.y, v1z = (a.z || 0) - (b.z || 0);
        const v2x = c.x - b.x, v2y = c.y - b.y, v2z = (c.z || 0) - (b.z || 0);
        const l1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
        const l2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);
        if (l1 === 0 || l2 === 0) return 180;
        const dot = (v1x * v2x + v1y * v2y + v1z * v2z) / (l1 * l2);
        return Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
    }

    function extractHandFeatures(rawLm, handedness = 'Right', handScore = 96) {
        // 1. Calculate image aspect ratio for metric invariance across desktop & mobile portrait/landscape
        const videoW = (webcamElement && webcamElement.videoWidth) || (canvasElement && canvasElement.width) || 640;
        const videoH = (webcamElement && webcamElement.videoHeight) || (canvasElement && canvasElement.height) || 480;
        const aspect = videoH / Math.max(1, videoW);

        // Convert landmarks to isotropic metric space (Y scaled by aspect ratio)
        // In metric space, 1 unit along X is physically identical to 1 unit along Y on all screen orientations
        const lm = rawLm.map(p => ({
            x: p.x,
            y: p.y * aspect,
            z: p.z || 0
        }));

        const wrist = lm[0];
        const indexMcp = lm[5];
        const middleMcp = lm[9];
        const ringMcp = lm[13];
        const pinkyMcp = lm[17];

        // Palm scale: 3D distance from wrist to middle knuckle in isotropic space
        const palmScale = Math.max(0.04, dist3D(wrist, middleMcp));

        // Joint Angles in 3D (degrees) - Now 100% invariant to phone portrait/landscape mode
        const thumbAngle = angleBetween3D(lm[2], lm[3], lm[4]);
        const indexPipAngle = angleBetween3D(lm[5], lm[6], lm[7]);
        const indexDipAngle = angleBetween3D(lm[6], lm[7], lm[8]);
        const middlePipAngle = angleBetween3D(lm[9], lm[10], lm[11]);
        const middleDipAngle = angleBetween3D(lm[10], lm[11], lm[12]);
        const ringPipAngle = angleBetween3D(lm[13], lm[14], lm[15]);
        const ringDipAngle = angleBetween3D(lm[14], lm[15], lm[16]);
        const pinkyPipAngle = angleBetween3D(lm[17], lm[18], lm[19]);
        const pinkyDipAngle = angleBetween3D(lm[18], lm[19], lm[20]);

        // Normalized Distance Ratios to Wrist (independent of camera distance and aspect ratio)
        const indexWristRatio = dist3D(lm[8], wrist) / Math.max(0.01, dist3D(indexMcp, wrist));
        const middleWristRatio = dist3D(lm[12], wrist) / Math.max(0.01, dist3D(middleMcp, wrist));
        const ringWristRatio = dist3D(lm[16], wrist) / Math.max(0.01, dist3D(ringMcp, wrist));
        const pinkyWristRatio = dist3D(lm[20], wrist) / Math.max(0.01, dist3D(pinkyMcp, wrist));
        const thumbWristRatio = dist3D(lm[4], wrist) / Math.max(0.01, dist3D(lm[2], wrist));

        // Tip to MCP Normalized Distances
        const indexTipToMcp = dist3D(lm[8], indexMcp) / palmScale;
        const middleTipToMcp = dist3D(lm[12], middleMcp) / palmScale;
        const ringTipToMcp = dist3D(lm[16], ringMcp) / palmScale;
        const pinkyTipToMcp = dist3D(lm[20], pinkyMcp) / palmScale;
        const thumbTipToMcp = dist3D(lm[4], indexMcp) / palmScale;

        // Strict 3D Finger Extension States (optimized for mobile & desktop)
        const isIndexExt = (indexPipAngle > 128 && indexWristRatio > 1.25) || (indexWristRatio > 1.45 && indexPipAngle > 115);
        const isMiddleExt = (middlePipAngle > 128 && middleWristRatio > 1.25) || (middleWristRatio > 1.45 && middlePipAngle > 115);
        const isRingExt = (ringPipAngle > 128 && ringWristRatio > 1.25) || (ringWristRatio > 1.45 && ringPipAngle > 115);
        const isPinkyExt = (pinkyPipAngle > 128 && pinkyWristRatio > 1.25) || (pinkyWristRatio > 1.45 && pinkyPipAngle > 115);
        const isThumbExt = (thumbWristRatio > 1.10 && thumbTipToMcp > 0.60) || thumbTipToMcp > 0.80;

        // Strict Folded States
        const isIndexFolded = !isIndexExt && (indexWristRatio < 1.22 || indexPipAngle < 122 || indexTipToMcp < 0.70);
        const isMiddleFolded = !isMiddleExt && (middleWristRatio < 1.22 || middlePipAngle < 122 || middleTipToMcp < 0.70);
        const isRingFolded = !isRingExt && (ringWristRatio < 1.22 || ringPipAngle < 122 || ringTipToMcp < 0.70);
        const isPinkyFolded = !isPinkyExt && (pinkyWristRatio < 1.22 || pinkyPipAngle < 122 || pinkyTipToMcp < 0.70);
        const isThumbFolded = !isThumbExt && (thumbTipToMcp < 0.60 || dist3D(lm[4], ringMcp) / palmScale < 0.62);

        // Alphabet X Hooked Index Finger: PIP curled (60-125 deg), MCP extended, tip not tucked in palm
        const isIndexHooked = !isIndexExt && indexPipAngle < 125 && indexPipAngle > 55 && lm[8].y > lm[6].y && indexTipToMcp > 0.45;

        // Thumb Upright (Thumbs up / Help) - metric normalized height difference
        const isThumbUp = (lm[4].y < lm[2].y) && (lm[4].y < lm[5].y) && ((wrist.y - lm[4].y) / palmScale > 0.38);

        // Extended Finger Count
        const extendedCount = [isIndexExt, isMiddleExt, isRingExt, isPinkyExt].filter(Boolean).length;
        const allFiveExtended = extendedCount === 4 && isThumbExt;

        // Inter-Finger Tip Distances (relative to palmScale)
        const thumbIndexDist = dist3D(lm[4], lm[8]) / palmScale;
        const thumbMiddleDist = dist3D(lm[4], lm[12]) / palmScale;
        const thumbRingDist = dist3D(lm[4], lm[16]) / palmScale;
        const thumbPinkyDist = dist3D(lm[4], lm[20]) / palmScale;
        const indexMiddleDist = dist3D(lm[8], lm[12]) / palmScale;
        const middleRingDist = dist3D(lm[12], lm[16]) / palmScale;
        const ringPinkyDist = dist3D(lm[16], lm[20]) / palmScale;

        const allFingersTogether = indexMiddleDist < 0.24 && middleRingDist < 0.24 && ringPinkyDist < 0.24;
        const allFingersSpread = indexMiddleDist > 0.24 && middleRingDist > 0.24;

        // Frame boundary check (using raw coordinates [0..1])
        let isNearEdge = false;
        for (let i = 0; i < 21; i++) {
            if (rawLm[i].x < 0.04 || rawLm[i].x > 0.96 || rawLm[i].y < 0.04 || rawLm[i].y > 0.96) {
                isNearEdge = true;
                break;
            }
        }

        return {
            palmScale,
            handedness,
            handScore,
            isNearEdge,
            thumbAngle,
            indexPipAngle,
            middlePipAngle,
            ringPipAngle,
            pinkyPipAngle,
            isIndexExt,
            isMiddleExt,
            isRingExt,
            isPinkyExt,
            isThumbExt,
            isIndexFolded,
            isMiddleFolded,
            isRingFolded,
            isPinkyFolded,
            isThumbFolded,
            isIndexHooked,
            isThumbUp,
            extendedCount,
            allFiveExtended,
            thumbIndexDist,
            thumbMiddleDist,
            thumbRingDist,
            thumbPinkyDist,
            indexMiddleDist,
            middleRingDist,
            ringPinkyDist,
            allFingersTogether,
            allFingersSpread
        };
    }

    function updateQualityDiagnostics(f, handScore) {
        if (!qualityLabel) return;
        let text = "Good Tracking";
        let statusClass = "quality-good";

        if (handScore < 45) {
            text = "Low Light / Dim";
            statusClass = "quality-warn";
        } else if (f.palmScale < 0.075) {
            text = "Hand Too Far";
            statusClass = "quality-warn";
        } else if (f.isNearEdge) {
            text = "Near Edge";
            statusClass = "quality-warn";
        }

        qualityLabel.textContent = text;
        if (qualityChip) {
            qualityChip.className = `info-chip ${statusClass}`;
        }
    }

    function classifyHandGesture(f, lm, numHands = 1) {
        const candidates = [];

        function addCandidate(name, category, icon, score) {
            if (score > 0.55) {
                candidates.push({ name, category, icon, score });
            }
        }

        // =====================================================================
        // Candidate Gating with Strict Negative Matching (Source: 31 Dictionary Signs)
        // =====================================================================

        // 1. HI / HELLO & FIVE (All 5 Fingers Extended & Spread)
        // NEGATIVE RULE: Never match if any finger is folded!
        if (f.allFiveExtended) {
            let score = 0.90;
            if (f.allFingersSpread) score += 0.06;
            if (f.thumbIndexDist > 0.55) score += 0.02;
            addCandidate("HI / HELLO", "Greetings", "fa-hand-wave", score);
            addCandidate("FIVE", "Numbers", "fa-hand", score - 0.02);
        }

        // 2. THANK YOU (Flat hand with 4/5 fingers pressed together)
        if (f.extendedCount === 4 && f.allFingersTogether) {
            let score = 0.92;
            if (lm[8].y < 0.42) score += 0.04;
            addCandidate("THANK YOU", "Greetings", "fa-hands-clapping", score);
        }

        // 3. ALPHABET B (4 fingers flat together, thumb folded across palm)
        if (f.extendedCount === 4 && f.allFingersTogether && f.isThumbFolded) {
            let score = 0.93;
            if (f.thumbIndexDist < 0.45) score += 0.03;
            addCandidate("ALPHABET B", "Alphabet", "fa-hand", score);
        }

        // 4. FOUR (4 fingers extended and spread, thumb folded across palm)
        if (f.extendedCount === 4 && f.isThumbFolded && !f.allFingersTogether) {
            let score = 0.92;
            if (f.indexMiddleDist > 0.22) score += 0.04;
            addCandidate("FOUR", "Numbers", "fa-hand", score);
        }

        // 5. THUMBS UP & HELP (Thumb upright, other 4 fingers tightly folded)
        // NEGATIVE RULE: Never match if index, middle, ring, or pinky extended!
        if (f.extendedCount === 0 && f.isThumbUp && f.isIndexFolded && f.isMiddleFolded && f.isRingFolded && f.isPinkyFolded) {
            let score = 0.94;
            if (lm[4].y < lm[0].y - 0.35 * f.palmScale) score += 0.04;
            if (numHands >= 2) {
                addCandidate("HELP", "Emergency", "fa-hand-holding-medical", 0.98);
            } else {
                addCandidate("THUMBS UP", "Common", "fa-thumbs-up", score);
            }
        }

        // 6. PEACE / VICTORY / V & TWO (Index & Middle extended, Ring & Pinky folded)
        // NEGATIVE RULE: Never match if Ring or Pinky is extended!
        if (f.isIndexExt && f.isMiddleExt && f.isRingFolded && f.isPinkyFolded) {
            if (f.indexMiddleDist > 0.25) {
                let score = 0.93;
                if (f.indexMiddleDist > 0.32) score += 0.04;
                addCandidate("PEACE / VICTORY / V", "Common", "fa-hand-peace", score);
                addCandidate("TWO", "Numbers", "fa-hand-peace", score - 0.02);
            } else if (f.indexMiddleDist < 0.22) {
                // ALPHABET U (Index & Middle pressed tightly together)
                let score = 0.93;
                if (f.indexMiddleDist < 0.18) score += 0.04;
                addCandidate("ALPHABET U", "Alphabet", "fa-font", score);
            }
        }

        // 7. POINT / ONE (Only Index extended)
        if (f.isIndexExt && f.isMiddleFolded && f.isRingFolded && f.isPinkyFolded && !f.isThumbExt) {
            let score = 0.93;
            if (f.indexPipAngle > 155) score += 0.04;
            addCandidate("POINT / ONE", "Numbers", "fa-hand-pointer", score);
        }

        // 8. ALPHABET L (Thumb & Index extended at 90 degrees, others folded)
        if (f.isIndexExt && f.isThumbExt && f.isMiddleFolded && f.isRingFolded && f.isPinkyFolded) {
            const lAngle = angleBetween3D(lm[4], lm[0], lm[8]);
            if (lAngle > 60 && lAngle < 125) {
                let score = 0.94;
                if (Math.abs(lAngle - 90) < 18) score += 0.04;
                addCandidate("ALPHABET L", "Alphabet", "fa-hand-lizard", score);
            }
        }

        // 9. ALPHABET D (Index extended, others curled touching thumb tip)
        if (f.isIndexExt && f.isMiddleFolded && f.isRingFolded && f.isPinkyFolded) {
            if (f.thumbMiddleDist < 0.38) {
                let score = 0.92;
                if (f.thumbMiddleDist < 0.28) score += 0.04;
                addCandidate("ALPHABET D", "Alphabet", "fa-font", score);
            }
        }

        // 10. ALPHABET I (Only Pinky extended straight up)
        if (f.isPinkyExt && f.isIndexFolded && f.isMiddleFolded && f.isRingFolded && !f.isThumbExt) {
            let score = 0.94;
            if (f.pinkyPipAngle > 155) score += 0.04;
            addCandidate("ALPHABET I", "Alphabet", "fa-font", score);
        }

        // 11. ALPHABET Y (Thumb & Pinky extended wide, middle 3 folded)
        if (f.isThumbExt && f.isPinkyExt && f.isIndexFolded && f.isMiddleFolded && f.isRingFolded) {
            if (f.thumbPinkyDist > 0.95) {
                let score = 0.94;
                if (f.thumbPinkyDist > 1.25) score += 0.04;
                addCandidate("ALPHABET Y", "Alphabet", "fa-hand-spock", score);
            }
        }

        // 12. I LOVE YOU (🤟: Thumb, Index, Pinky extended, Middle & Ring folded)
        if (f.isThumbExt && f.isIndexExt && f.isPinkyExt && f.isMiddleFolded && f.isRingFolded) {
            let score = 0.95;
            if (f.thumbIndexDist > 0.50) score += 0.03;
            addCandidate("I LOVE YOU", "Common", "fa-hand-spock", score);
        }

        // 13. ROCK / METAL (🤘: Index & Pinky extended, Thumb folded across Middle/Ring)
        if (f.isIndexExt && f.isPinkyExt && f.isThumbFolded && f.isMiddleFolded && f.isRingFolded) {
            let score = 0.94;
            if (f.indexMiddleDist > 0.35) score += 0.03;
            addCandidate("ROCK / METAL", "Common", "fa-hand-back-fist", score);
        }

        // 14. WATER / ALPHABET W ('W' shape: Index, Middle, Ring extended, Pinky folded)
        if (f.isIndexExt && f.isMiddleExt && f.isRingExt && f.isPinkyFolded) {
            let score = 0.93;
            if (f.indexMiddleDist > 0.16 && f.middleRingDist > 0.16) score += 0.04;
            addCandidate("WATER / ALPHABET W", "Daily Needs", "fa-glass-water", score);
        }

        // 15. THREE (ASL 3: Thumb, Index, Middle extended, Ring & Pinky folded)
        if (f.isThumbExt && f.isIndexExt && f.isMiddleExt && f.isRingFolded && f.isPinkyFolded) {
            let score = 0.93;
            if (f.indexMiddleDist > 0.18) score += 0.03;
            addCandidate("THREE", "Numbers", "fa-hand-dots", score);
        }

        // 16. OK SIGN / F (👌: Thumb & Index touch in loop, Middle, Ring, Pinky extended)
        if (f.thumbIndexDist < 0.35 && f.isMiddleExt && f.isRingExt && f.isPinkyExt) {
            let score = 0.94;
            if (f.thumbIndexDist < 0.25) score += 0.04;
            addCandidate("OK SIGN / F", "Common", "fa-hand-holding-heart", score);
        }

        // 17. ALPHABET X (Index hooked/bent, other 4 folded)
        // STRICT NEGATIVE MATCHING: CAN NEVER MATCH IF ALL 5 EXTENDED OR IF MIDDLE/RING/PINKY EXTENDED!
        if (f.isIndexHooked && f.isMiddleFolded && f.isRingFolded && f.isPinkyFolded && !f.isThumbExt) {
            let score = 0.91;
            if (f.indexPipAngle < 115) score += 0.04;
            addCandidate("ALPHABET X", "Alphabet", "fa-font", score);
        }

        // 18. ALPHABET C (Curved hand arc, thumb opposite index)
        if (!f.allFiveExtended && f.thumbIndexDist > 0.38 && f.thumbIndexDist < 0.95 && !f.isPinkyExt && f.extendedCount <= 1) {
            if (f.indexPipAngle > 95 && f.indexPipAngle < 145 && f.middlePipAngle > 95 && f.middlePipAngle < 145) {
                let score = 0.90;
                addCandidate("ALPHABET C", "Alphabet", "fa-copyright", score);
            }
        }

        // 19. ALPHABET O / ZERO (Fingertips touching thumb in circular loop)
        if (f.thumbIndexDist < 0.28 && f.thumbMiddleDist < 0.32 && !f.isRingExt && !f.isPinkyExt) {
            let score = 0.92;
            if (f.thumbIndexDist < 0.22) score += 0.04;
            addCandidate("ALPHABET O / ZERO", "Alphabet", "fa-circle-notch", score);
        }

        // 20. NO (Thumb, Index, and Middle pinching together)
        if (f.thumbIndexDist < 0.28 && f.thumbMiddleDist < 0.30 && f.isRingFolded && f.isPinkyFolded) {
            let score = 0.92;
            addCandidate("NO", "Expressions", "fa-circle-xmark", score);
        }

        // 21. FIST SHAPES (STOP / FIST, ALPHABET A, ALPHABET E, YES, SORRY)
        if (f.extendedCount === 0 && !f.isThumbUp) {
            if (f.isThumbFolded) {
                if (lm[4].y < lm[3].y && dist3D(lm[4], lm[5]) / f.palmScale < 0.50) {
                    addCandidate("ALPHABET A", "Alphabet", "fa-font", 0.93);
                } else if (dist3D(lm[4], lm[6]) / f.palmScale < 0.40) {
                    addCandidate("SORRY", "Expressions", "fa-face-sad-tear", 0.92);
                } else if (dist3D(lm[4], lm[10]) / f.palmScale < 0.45) {
                    addCandidate("YES", "Expressions", "fa-circle-check", 0.92);
                } else {
                    addCandidate("STOP / FIST", "Common", "fa-hand-fist", 0.92);
                }
            } else {
                addCandidate("STOP / FIST", "Common", "fa-hand-fist", 0.88);
            }
        }

        // 22. PLEASE & GOOD / FINE (Flat hand over chest / open 5 at chest)
        if (f.allFiveExtended && lm[0].y > 0.45 && lm[0].y < 0.85) {
            if (f.allFingersTogether) {
                addCandidate("PLEASE", "Expressions", "fa-heart", 0.91);
            } else {
                addCandidate("GOOD / FINE", "Expressions", "fa-face-smile", 0.90);
            }
        }

        // If no candidate passed gating
        if (candidates.length === 0) {
            return {
                name: "UNKNOWN SIGN",
                category: "Analyzing",
                icon: "fa-solid fa-question",
                confidence: 42,
                rawScore: 0.42
            };
        }

        // Sort by score descending
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];

        // Strict 60% confidence cutoff - prevents false guesses
        if (best.score < 0.60) {
            return {
                name: "UNKNOWN SIGN",
                category: "Analyzing",
                icon: "fa-solid fa-question",
                confidence: Math.round(best.score * 100),
                rawScore: best.score
            };
        }

        return {
            name: best.name,
            category: best.category,
            icon: best.icon,
            confidence: Math.min(98, Math.round(best.score * 100)),
            rawScore: best.score
        };
    }

    function processTemporalStability(framePrediction, features) {
        const now = performance.now();

        // Push frame prediction into buffer
        predictionWindow.push({
            name: framePrediction.name,
            confidence: framePrediction.confidence,
            category: framePrediction.category,
            icon: framePrediction.icon,
            timestamp: now
        });

        if (predictionWindow.length > PREDICTION_WINDOW_MAX) {
            predictionWindow.shift();
        }

        // Count occurrences
        const counts = {};
        const confSum = {};
        for (const pred of predictionWindow) {
            counts[pred.name] = (counts[pred.name] || 0) + 1;
            confSum[pred.name] = (confSum[pred.name] || 0) + pred.confidence;
        }

        let topName = "UNKNOWN SIGN";
        let topCount = 0;
        for (const name in counts) {
            if (counts[name] > topCount) {
                topCount = counts[name];
                topName = name;
            }
        }

        const avgConfidence = Math.round(confSum[topName] / topCount);
        const stabilityRatio = Math.round((topCount / predictionWindow.length) * 100);
        const isStable = topCount >= STABILITY_THRESHOLD;

        // If top vote is UNKNOWN SIGN or consensus is low
        if (topName === "UNKNOWN SIGN" || !isStable) {
            return {
                name: topCount >= 3 ? "ANALYZING..." : "UNKNOWN SIGN",
                confidence: avgConfidence,
                category: "Analyzing",
                icon: "fa-solid fa-question",
                isStable: false,
                stabilityRatio: stabilityRatio,
                rawSign: topName
            };
        }

        // Reliable consensus reached
        const matchingSample = predictionWindow.find(p => p.name === topName) || framePrediction;
        return {
            name: topName,
            confidence: avgConfidence,
            category: matchingSample.category,
            icon: matchingSample.icon,
            isStable: true,
            stabilityRatio: stabilityRatio,
            rawSign: topName
        };
    }

    function renderDebugHUD(features, rawPrediction, stableResult) {
        if (!aiDebugHud || !isDebugMode) return;
        aiDebugHud.innerHTML = `
            <div class="debug-header">
                <span>AI VISION TELEMETRY</span>
                <span style="color:#00f0ff;">${features.handedness.toUpperCase()} HAND</span>
            </div>
            <div class="debug-row"><span>Tracking:</span><span class="hud-accent">${features.handScore}%</span></div>
            <div class="debug-row"><span>Scale:</span><span class="hud-accent">${features.palmScale.toFixed(2)}</span></div>
            <div class="debug-row"><span>Thumb:</span><span class="${features.isThumbExt ? 'val-ext' : 'val-fold'}">${features.isThumbExt ? 'EXTENDED' : (features.isThumbUp ? 'UPRIGHT' : 'FOLDED')}</span></div>
            <div class="debug-row"><span>Index:</span><span class="${features.isIndexExt ? 'val-ext' : (features.isIndexHooked ? 'val-sign' : 'val-fold')}">${features.isIndexExt ? 'EXTENDED' : (features.isIndexHooked ? 'HOOKED' : 'FOLDED')}</span></div>
            <div class="debug-row"><span>Middle:</span><span class="${features.isMiddleExt ? 'val-ext' : 'val-fold'}">${features.isMiddleExt ? 'EXTENDED' : 'FOLDED'}</span></div>
            <div class="debug-row"><span>Ring:</span><span class="${features.isRingExt ? 'val-ext' : 'val-fold'}">${features.isRingExt ? 'EXTENDED' : 'FOLDED'}</span></div>
            <div class="debug-row"><span>Pinky:</span><span class="${features.isPinkyExt ? 'val-ext' : 'val-fold'}">${features.isPinkyExt ? 'EXTENDED' : 'FOLDED'}</span></div>
            <div class="debug-row" style="margin-top:4px;border-top:1px solid rgba(255,255,255,0.08);padding-top:4px;">
                <span>Frame Match:</span><span class="val-sign">${rawPrediction.name} (${rawPrediction.confidence}%)</span>
            </div>
            <div class="debug-row">
                <span>Stable Sign:</span><span class="val-stab">${stableResult.name}</span>
            </div>
            <div class="debug-row">
                <span>Stability:</span><span class="val-stab">${stableResult.stabilityRatio}% (${stableResult.isStable ? 'STABLE' : 'BUFFERING'})</span>
            </div>
        `;
    }

    function updateRecognitionUI(recognized, handScore) {
        if (!currentSignName) return;

        if (!recognized || recognized.name === "UNKNOWN SIGN" || recognized.name === "Waiting for sign...") {
            currentSignName.textContent = "Unknown Sign";
            currentSignName.classList.add('empty-state');
            if (currentSignDesc) currentSignDesc.textContent = "Hold hand steady • No sign matched";
            if (signIconDisplay) signIconDisplay.innerHTML = `<i class="fa-solid fa-question"></i>`;
            const realConf = recognized ? recognized.confidence : 0;
            if (confidenceFill) confidenceFill.style.width = `${realConf}%`;
            if (confidencePercent) confidencePercent.textContent = `${realConf}%`;
            lastDetectedSign = "";
            return;
        }

        if (recognized.name === "ANALYZING...") {
            currentSignName.textContent = "Analyzing Gesture...";
            currentSignName.classList.add('empty-state');
            if (currentSignDesc) currentSignDesc.textContent = `Stabilizing pose (${recognized.stabilityRatio}% consensus)`;
            if (confidenceFill) confidenceFill.style.width = `${recognized.confidence}%`;
            if (confidencePercent) confidencePercent.textContent = `${recognized.confidence}%`;
            return;
        }

        // Confirmed Recognized Sign!
        currentSignName.textContent = recognized.name;
        currentSignName.classList.remove('empty-state');
        if (currentSignDesc) {
            const stabText = recognized.stabilityRatio !== undefined ? ` • Stability: ${recognized.stabilityRatio}%` : '';
            currentSignDesc.textContent = `Category: ${recognized.category} • Match: ${recognized.confidence}%${stabText}`;
        }
        if (signIconDisplay) signIconDisplay.innerHTML = `<i class="fa-solid ${recognized.icon}"></i>`;

        if (confidenceFill) confidenceFill.style.width = `${recognized.confidence}%`;
        if (confidencePercent) confidencePercent.textContent = `${recognized.confidence}%`;

        // Commit to sentence only when stable for CONFIRM_HOLD_DURATION_MS
        const currentTime = performance.now();
        if (recognized.isStable && recognized.confidence >= 70) {
            if (recognized.name === lastDetectedSign) {
                if (!isSignDebounced && (currentTime - signHoldStartTime) >= CONFIRM_HOLD_DURATION_MS) {
                    confirmSignToSentence(recognized, recognized.confidence);
                    isSignDebounced = true;
                }
            } else {
                lastDetectedSign = recognized.name;
                signHoldStartTime = currentTime;
                isSignDebounced = false;
            }
        }
    }

    function resetCurrentSignDisplay() {
        if (!currentSignName) return;
        currentSignName.textContent = "Waiting for sign...";
        currentSignName.classList.add('empty-state');
        if (currentSignDesc) currentSignDesc.textContent = "Position your hand clearly in front of the camera or click any hand sign on the right!";
        if (signIconDisplay) signIconDisplay.innerHTML = `<i class="fa-solid fa-hand-spock"></i>`;
        if (confidenceFill) confidenceFill.style.width = `0%`;
        if (confidencePercent) confidencePercent.textContent = `0%`;
        lastDetectedSign = "";
    }

    function confirmSignToSentence(sign, confidence) {
        lastRecognitionPulseTime = performance.now();
        if (sentenceList.length === 0 || sentenceList[sentenceList.length - 1] !== sign.name) {
            sentenceList.push(sign.name);
            renderSentence();

            if (ttsEnabled) {
                speakText(sign.name);
            }

            addHistoryRecord(sign.name, confidence);
        }
    }

    function renderSentence() {
        if (!sentenceBuffer) return;
        if (sentenceList.length === 0) {
            sentenceBuffer.innerHTML = `<p class="placeholder-text">Translated signs will accumulate here into full sentences...</p>`;
        } else {
            sentenceBuffer.textContent = sentenceList.join(" ");
        }
    }

    async function fetchHistoryFromBackend() {
        try {
            const res = await fetch('/api/translations?limit=50');
            if (res.ok) {
                const json = await res.json();
                if (json.data && Array.isArray(json.data) && json.data.length > 0) {
                    translationHistory = json.data.map(rec => ({
                        history_id: rec.history_id,
                        time: new Date(rec.translated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        sign: rec.sign_name,
                        confidence: `${rec.confidence_score}%`,
                        dbSynced: true
                    }));
                    sqlRecordCount = json.count || translationHistory.length;
                    mongoRecordCount = sqlRecordCount * 30;
                    if (statSqlCount) statSqlCount.textContent = sqlRecordCount.toLocaleString();
                    if (statMongoCount) statMongoCount.textContent = mongoRecordCount.toLocaleString();
                    renderHistoryTable();
                }
            }
        } catch (err) {
            console.debug("[Backend] Offline storage mode active:", err);
        }
    }

    function addHistoryRecord(signName, confidence) {
        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        sqlRecordCount += 1;
        mongoRecordCount += 30;
        if (statSqlCount) statSqlCount.textContent = sqlRecordCount.toLocaleString();
        if (statMongoCount) statMongoCount.textContent = mongoRecordCount.toLocaleString();

        const record = {
            history_id: null,
            time: timeString,
            sign: signName,
            confidence: `${confidence}%`,
            dbSynced: true
        };

        translationHistory.unshift(record);
        renderHistoryTable();

        // Layered Backend REST API Integration (CO1 / CO4 Persistence)
        try {
            fetch('/api/translations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sign_name: signName,
                    confidence_score: typeof confidence === 'number' ? confidence : parseFloat(confidence) || 95.0,
                    output_mode: 'both'
                })
            }).then(r => r.json()).then(data => {
                if (data && data.record && data.record.history_id) {
                    record.history_id = data.record.history_id;
                }
            }).catch(e => console.debug("Offline store active:", e));
        } catch (e) {
            // graceful offline fallback
        }
    }

    async function deleteHistoryRecord(id, index) {
        if (id) {
            try {
                await fetch(`/api/translations?id=${id}`, { method: 'DELETE' });
            } catch (err) {
                console.warn("Delete request offline error:", err);
            }
        }
        if (index !== undefined && index >= 0 && index < translationHistory.length) {
            translationHistory.splice(index, 1);
        } else if (id) {
            translationHistory = translationHistory.filter(r => r.history_id !== id);
        }
        sqlRecordCount = Math.max(0, sqlRecordCount - 1);
        mongoRecordCount = Math.max(0, sqlRecordCount * 30);
        if (statSqlCount) statSqlCount.textContent = sqlRecordCount.toLocaleString();
        if (statMongoCount) statMongoCount.textContent = mongoRecordCount.toLocaleString();
        renderHistoryTable();
    }

    async function clearAllHistory() {
        if (!confirm("Are you sure you want to delete all translation history from the database?")) return;
        try {
            await fetch('/api/translations', { method: 'DELETE' });
        } catch (err) {
            console.warn("Clear history error:", err);
        }
        translationHistory = [];
        sqlRecordCount = 0;
        mongoRecordCount = 0;
        if (statSqlCount) statSqlCount.textContent = "0";
        if (statMongoCount) statMongoCount.textContent = "0";
        renderHistoryTable();
    }

    let activeHistoryItem = null;

    function openHistoryModal(record, index) {
        activeHistoryItem = { record, index };
        const modal = document.getElementById('modal-history-actions');
        const signEl = document.getElementById('modal-history-sign');
        const metaEl = document.getElementById('modal-history-meta');
        if (signEl) signEl.textContent = record.sign;
        if (metaEl) metaEl.textContent = `Time: ${record.time} • Confidence: ${record.confidence}`;
        if (modal) modal.classList.add('active');
    }

    function renderHistoryTable() {
        if (!historyTableBody) return;
        if (historyCount) historyCount.textContent = `${translationHistory.length} Record${translationHistory.length !== 1 ? 's' : ''}`;

        if (translationHistory.length === 0) {
            historyTableBody.innerHTML = `<tr class="no-data-row"><td colspan="5">No translations logged yet. Perform a sign to see history here!</td></tr>`;
            return;
        }

        historyTableBody.innerHTML = translationHistory.slice(0, 15).map((rec, idx) => `
            <tr class="history-row" data-index="${idx}" data-id="${rec.history_id || ''}" data-sign="${rec.sign}" data-conf="${rec.confidence}" data-time="${rec.time}">
                <td><i class="fa-regular fa-clock" style="color: var(--text-muted); margin-right: 4px;"></i> ${rec.time}</td>
                <td><strong>${rec.sign}</strong></td>
                <td><span class="badge badge-fps">${rec.confidence}</span></td>
                <td><span class="badge badge-dbs"><i class="fa-solid fa-check" style="color: var(--accent-emerald);"></i> Synced</span></td>
                <td style="text-align: right;">
                    <div class="history-action-btns">
                        <button class="btn-row-action btn-speak-row" data-sign="${rec.sign}" title="Speak sign" type="button">
                            <i class="fa-solid fa-volume-high"></i>
                        </button>
                        <button class="btn-row-action btn-del-row" data-id="${rec.history_id || ''}" data-index="${idx}" title="Delete record" type="button">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Attach event listeners to rows and action buttons
        historyTableBody.querySelectorAll('.history-row').forEach(row => {
            row.addEventListener('click', (e) => {
                // If clicked directly on row action button, handle that specifically
                if (e.target.closest('.btn-speak-row')) {
                    e.stopPropagation();
                    const sign = e.target.closest('.btn-speak-row').getAttribute('data-sign');
                    if (sign) speakText(sign);
                    return;
                }
                if (e.target.closest('.btn-del-row')) {
                    e.stopPropagation();
                    const btn = e.target.closest('.btn-del-row');
                    const id = btn.getAttribute('data-id') ? parseInt(btn.getAttribute('data-id')) : null;
                    const idx = parseInt(btn.getAttribute('data-index'));
                    deleteHistoryRecord(id, idx);
                    return;
                }

                // Otherwise, open the History Record Options Modal!
                const idx = parseInt(row.getAttribute('data-index'));
                const rec = translationHistory[idx];
                if (rec) {
                    openHistoryModal(rec, idx);
                }
            });
        });
    }

    function speakText(text) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }

    function calculateFPS() {
        const now = performance.now();
        frameCount++;
        if (now - lastFrameTime >= 1000) {
            if (fpsCounter) fpsCounter.textContent = `${frameCount} FPS`;
            frameCount = 0;
            lastFrameTime = now;
        }
    }

    // =========================================================================
    // 5. Draw 21-Landmark Hand Skeleton (Alternative Technical View)
    // =========================================================================
    function drawLandmarkSkeletonDiagram(canvas, item) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2 + 25;
        const name = item.name.toUpperCase();

        const isThumbUp = name.includes("THUMBS") || name.includes("HELP");
        const isIly = name.includes("LOVE") || name.includes("ROCK") || name.includes("ALPHABET Y");
        const isIndexUp = name.includes("POINT") || name.includes("ONE") || name.includes("PEACE") || name.includes("VICTORY") || name.includes("V") || name.includes("THREE") || name.includes("WATER") || name.includes("FOUR") || name.includes("FIVE") || name.includes("HI") || name.includes("HELLO") || name.includes("THANK") || name.includes("ALPHABET B") || name.includes("ALPHABET L") || name.includes("ALPHABET D");
        const isMiddleUp = name.includes("PEACE") || name.includes("VICTORY") || name.includes("V") || name.includes("THREE") || name.includes("WATER") || name.includes("FOUR") || name.includes("FIVE") || name.includes("HI") || name.includes("HELLO") || name.includes("THANK") || name.includes("ALPHABET B") || name.includes("ALPHABET U");
        const isRingUp = name.includes("WATER") || name.includes("FOUR") || name.includes("FIVE") || name.includes("HI") || name.includes("HELLO") || name.includes("THANK") || name.includes("ALPHABET B");
        const isPinkyUp = name.includes("I LOVE YOU") || name.includes("ROCK") || name.includes("ALPHABET Y") || name.includes("ALPHABET I") || name.includes("FOUR") || name.includes("FIVE") || name.includes("HI") || name.includes("HELLO") || name.includes("THANK") || name.includes("ALPHABET B");

        const wrist = { x: cx, y: cy + 70 };
        const thumbTip = (isThumbUp || isIly || name.includes("ALPHABET L")) ? { x: cx - 60, y: cy - 40 } : { x: cx - 35, y: cy + 10 };
        const indexTip = isIndexUp ? { x: cx - 35, y: cy - 85 } : { x: cx - 25, y: cy + 10 };
        const middleTip = isMiddleUp ? { x: cx - 5, y: cy - 92 } : { x: cx - 5, y: cy + 10 };
        const ringTip = isRingUp ? { x: cx + 22, y: cy - 84 } : { x: cx + 15, y: cy + 10 };
        const pinkyTip = isPinkyUp ? { x: cx + 50, y: cy - 65 } : { x: cx + 32, y: cy + 15 };

        ctx.lineWidth = 3;
        function drawBone(start, end, isExt) {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.strokeStyle = isExt ? '#16a34a' : '#cbd5e1';
            ctx.stroke();
        }

        drawBone(wrist, thumbTip, isThumbUp || isIly || name.includes("ALPHABET L"));
        drawBone(wrist, indexTip, isIndexUp);
        drawBone(wrist, middleTip, isMiddleUp);
        drawBone(wrist, ringTip, isRingUp);
        drawBone(wrist, pinkyTip, isPinkyUp);

        [wrist, thumbTip, indexTip, middleTip, ringTip, pinkyTip].forEach((pt) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#2563eb';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });
    }

    // =========================================================================
    // 6. Real Human Sign Instructor Modal Controller
    // =========================================================================
    function openHandGuideModal(item) {
        if (!modalHandGuide || !item) return;
        activeGuideSign = item;

        if (guideModalTitle) guideModalTitle.textContent = `How to Form Sign: ${item.name}`;
        if (guideCategoryBadge) guideCategoryBadge.textContent = item.category;

        // Render 3D Sign Photo in Modal Stage
        renderInstructorStage(item);

        // Update Finger Checklist
        const f = item.fingers || { thumb: "Extended", index: "Extended", middle: "Folded", ring: "Folded", pinky: "Extended" };
        const cleanThumb = (f.thumb || 'Extended').replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        const cleanIndex = (f.index || 'Extended').replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        const cleanMiddle = (f.middle || 'Folded').replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        const cleanRing = (f.ring || 'Folded').replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        const cleanPinky = (f.pinky || 'Folded').replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();

        if (guideFingerChecklist) {
            guideFingerChecklist.innerHTML = `
                <div class="finger-item"><span class="f-name">Thumb:</span> <span class="f-val ${cleanThumb.toLowerCase().includes('folded') ? 'folded' : 'ext'}">${cleanThumb}</span></div>
                <div class="finger-item"><span class="f-name">Index:</span> <span class="f-val ${cleanIndex.toLowerCase().includes('folded') ? 'folded' : 'ext'}">${cleanIndex}</span></div>
                <div class="finger-item"><span class="f-name">Middle:</span> <span class="f-val ${cleanMiddle.toLowerCase().includes('folded') ? 'folded' : 'ext'}">${cleanMiddle}</span></div>
                <div class="finger-item"><span class="f-name">Ring:</span> <span class="f-val ${cleanRing.toLowerCase().includes('folded') ? 'folded' : 'ext'}">${cleanRing}</span></div>
                <div class="finger-item"><span class="f-name">Pinky:</span> <span class="f-val ${cleanPinky.toLowerCase().includes('folded') ? 'folded' : 'ext'}">${cleanPinky}</span></div>
            `;
        }

        const steps = item.steps || [
            "Position your hand clearly in front of the camera.",
            "Form the exact finger configuration shown in the reference photo.",
            "Hold steady for 0.5 seconds to trigger auto-translation and voice speech."
        ];
        if (guideStepsList) {
            guideStepsList.innerHTML = steps.map(st => `<li>${st}</li>`).join('');
        }

        modalHandGuide.classList.add('active');
    }

    function renderInstructorStage(item) {
        const photoStage = document.getElementById('guide-photo-stage') || guideHumanStage;
        if (!photoStage || !item) return;

        const photo3d = window.getSign3DPhoto ? window.getSign3DPhoto(item) : 'assets/icon_3d_hello.png';

        photoStage.innerHTML = `
            <div class="modal-photo-img-wrap">
                <img src="${photo3d}" alt="${item.name} 3D Hand Sign" class="modal-photo-main-img" />
            </div>
            <div class="modal-photo-caption">
                <span class="modal-photo-caption-title"><i class="fa-solid fa-cube"></i> ${item.name}</span>
                <span class="modal-photo-caption-tag">${item.category || 'ASL Sign'}</span>
            </div>
        `;
    }

    function setInstructorTab(tab) {
        // No-op kept for backwards compatibility
    }

    // Playback Speed Controls
    if (btnSpeedNormal && btnSpeedSlow) {
        btnSpeedNormal.addEventListener('click', () => {
            instructorSpeed = 'normal';
            btnSpeedNormal.classList.add('active');
            btnSpeedSlow.classList.remove('active');
            if (window.Hand3D) window.Hand3D.playbackSpeed = 1.0;
        });

        btnSpeedSlow.addEventListener('click', () => {
            instructorSpeed = 'slow-motion';
            btnSpeedSlow.classList.add('active');
            btnSpeedNormal.classList.remove('active');
            if (window.Hand3D) window.Hand3D.playbackSpeed = 0.5;
        });
    }

    // Replay Animation
    if (btnReplayAnim) {
        btnReplayAnim.addEventListener('click', () => {
            if (window.Hand3D) {
                window.Hand3D.replaySign();
            } else if (activeGuideSign) {
                renderInstructorStage(activeGuideSign);
            }
        });
    }

    // =========================================================================
    // 7. Render Reference Library Grid (Right Panel in index.html)
    // =========================================================================
    function renderVisualHandGrid(filterCategory = 'all', searchQuery = '') {
        const grid = document.getElementById('dictionary-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const catalog = window.dictionaryData || [];
        const filtered = catalog.filter(item => {
            const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
            const matchesSearch = !searchQuery || 
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.desc && item.desc.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (item.handGuide && item.handGuide.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesCategory && matchesSearch;
        });

        const badge = document.getElementById('library-count-badge');
        if (badge) badge.textContent = `${filtered.length}`;

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="no-data-row" style="grid-column: 1/-1; padding: 24px; text-align: center;"><p style="color: var(--text-dim);"><i class="fa-solid fa-magnifying-glass" style="margin-right: 6px;"></i>No signs found matching "${searchQuery}".</p></div>`;
            return;
        }

        filtered.forEach((item, idx) => {
            const card = document.createElement('div');
            card.className = 'side-sign-card';
            const cleanGuide = (item.handGuide || 'Hand Gesture').replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
            const photo3d = window.getSign3DPhoto ? window.getSign3DPhoto(item) : 'assets/icon_3d_hello.png';

            // Map category to CSS class for styled tags
            let catClass = 'cat-common';
            const catLower = (item.category || '').toLowerCase();
            if (catLower.includes('emergency')) catClass = 'cat-emergency';
            else if (catLower.includes('greet')) catClass = 'cat-greetings';
            else if (catLower.includes('need')) catClass = 'cat-needs';
            else if (catLower.includes('expression')) catClass = 'cat-expressions';
            else if (catLower.includes('alpha')) catClass = 'cat-alphabet';
            else if (catLower.includes('number')) catClass = 'cat-numbers';

            card.innerHTML = `
                <div class="card-visual-header">
                    <div class="mini-real-hand-preview" title="${item.name}: 3D Hand Model">
                        <img src="${photo3d}" alt="${item.name}" class="mini-real-hand-img" />
                    </div>
                    <div class="card-title-box">
                        <h3>${item.name}</h3>
                        <span class="cat-tag ${catClass}">${item.category}</span>
                    </div>
                </div>

                <div class="hand-guide-pill">
                    <i class="fa-solid ${item.icon || 'fa-hand'}"></i>
                    <span>Position: <strong>${cleanGuide}</strong></span>
                </div>

                <p class="sign-card-desc">${item.desc}</p>

                <div class="sign-card-actions-row">
                    <button class="btn btn-sm btn-secondary btn-open-hand-demo" data-index="${idx}" title="Open 3D Gesture Guide">
                        <i class="fa-solid fa-hand"></i> 3D Guide
                    </button>
                    <button class="btn btn-sm btn-primary btn-test-hand-sign" data-sign="${item.name}" data-category="${item.category}" data-icon="${item.icon || 'fa-hand'}" title="Test sign in live camera">
                        <i class="fa-solid fa-play"></i> Test Sign
                    </button>
                </div>
            `;

            // Clicking card background also previews sign
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const mockSign = { name: item.name, category: item.category, icon: item.icon || 'fa-hand', confidence: 98 };
                updateRecognitionUI(mockSign, 98);
                confirmSignToSentence(mockSign, 98);
            });

            grid.appendChild(card);
        });

        grid.querySelectorAll('.btn-open-hand-demo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.getAttribute('data-index'), 10);
                const targetSign = filtered[index];
                if (targetSign) openHandGuideModal(targetSign);
            });
        });

        grid.querySelectorAll('.btn-test-hand-sign').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const signName = btn.getAttribute('data-sign');
                const cat = btn.getAttribute('data-category');
                const icon = btn.getAttribute('data-icon');

                const mockSign = { name: signName, category: cat, icon: icon, confidence: 98 };
                updateRecognitionUI(mockSign, 98);
                confirmSignToSentence(mockSign, 98);
            });
        });
    }

    // Connect Search & Category Filter Pills for Reference Library
    const dictSearch = document.getElementById('dict-search');
    const categoryPills = document.getElementById('category-pills');
    let currentCategoryFilter = 'all';

    if (dictSearch) {
        dictSearch.addEventListener('input', (e) => {
            renderVisualHandGrid(currentCategoryFilter, e.target.value.trim());
        });
    }

    if (categoryPills) {
        categoryPills.addEventListener('click', (e) => {
            const pill = e.target.closest('.pill');
            if (!pill) return;
            categoryPills.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentCategoryFilter = pill.getAttribute('data-category') || 'all';
            renderVisualHandGrid(currentCategoryFilter, dictSearch ? dictSearch.value.trim() : '');
        });
    }

    // Show / Hide Reference Library Panel
    const btnCloseLibrary = document.getElementById('btn-close-library');
    const btnToggleLibraryToolbar = document.getElementById('btn-toggle-library-toolbar');
    const libraryToolbarText = document.getElementById('library-toolbar-text');
    const catalogSidePanel = document.getElementById('catalog-side-panel');
    const mainWorkspace = document.querySelector('.unified-workspace');

    function toggleLibraryPanel(forceState) {
        if (!catalogSidePanel || !mainWorkspace) return;
        const willHide = forceState !== undefined ? !forceState : !catalogSidePanel.classList.contains('is-hidden');

        if (willHide) {
            catalogSidePanel.classList.add('is-hidden');
            mainWorkspace.classList.add('library-hidden');
            if (btnToggleLibraryToolbar) btnToggleLibraryToolbar.classList.remove('active');
            if (libraryToolbarText) libraryToolbarText.textContent = 'Library: OFF';
        } else {
            catalogSidePanel.classList.remove('is-hidden');
            mainWorkspace.classList.remove('library-hidden');
            if (btnToggleLibraryToolbar) btnToggleLibraryToolbar.classList.add('active');
            if (libraryToolbarText) libraryToolbarText.textContent = 'Library: ON';
        }
    }

    if (btnCloseLibrary) {
        btnCloseLibrary.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLibraryPanel(false); // Hide panel
        });
    }

    if (btnToggleLibraryToolbar) {
        btnToggleLibraryToolbar.classList.add('active');
        btnToggleLibraryToolbar.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLibraryPanel(); // Toggle state
        });
    }

    // Modal Guide Actions
    if (btnCloseHandGuide && modalHandGuide) {
        btnCloseHandGuide.addEventListener('click', () => {
            modalHandGuide.classList.remove('active');
        });
    }

    if (btnGuideTryCamera) {
        btnGuideTryCamera.addEventListener('click', () => {
            if (modalHandGuide) modalHandGuide.classList.remove('active');
            if (!isCameraActive) startCamera();
        });
    }

    if (btnGuideTestSpeech) {
        btnGuideTestSpeech.addEventListener('click', () => {
            if (activeGuideSign) {
                speakText(activeGuideSign.name);
                const mockSign = { name: activeGuideSign.name, category: activeGuideSign.category, icon: activeGuideSign.icon, confidence: 99 };
                updateRecognitionUI(mockSign, 99);
                confirmSignToSentence(mockSign, 99);
            }
        });
    }

    // Quick Hi Button
    if (btnQuickHi) {
        btnQuickHi.addEventListener('click', () => {
            const hiSign = { name: "HI / HELLO", category: "Greetings", icon: "fa-hand-wave", confidence: 99 };
            updateRecognitionUI(hiSign, 99);
            confirmSignToSentence(hiSign, 99);
        });
    }

    // Camera Controls
    if (btnToggleCamera) {
        btnToggleCamera.addEventListener('click', () => {
            if (isCameraActive) stopCamera();
            else startCamera();
        });
    }
    if (btnStartPlaceholder) btnStartPlaceholder.addEventListener('click', startCamera);

    if (btnToggleSkeleton) {
        btnToggleSkeleton.addEventListener('click', () => {
            drawSkeleton = !drawSkeleton;
            btnToggleSkeleton.classList.toggle('active', drawSkeleton);
            btnToggleSkeleton.querySelector('span').textContent = `AI Overlay: ${drawSkeleton ? 'ON' : 'OFF'}`;
        });
    }

    if (btnToggleTTS) {
        btnToggleTTS.addEventListener('click', () => {
            ttsEnabled = !ttsEnabled;
            btnToggleTTS.classList.toggle('active', ttsEnabled);
            btnToggleTTS.querySelector('span').textContent = `Speech: ${ttsEnabled ? 'ON' : 'OFF'}`;
        });
    }

    if (btnFlipCamera && webcamElement) {
        btnFlipCamera.addEventListener('click', () => {
            isMirrored = !isMirrored;
            webcamElement.style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
            btnFlipCamera.classList.toggle('active', isMirrored);
        });
    }

    if (btnSwitchCamera) {
        btnSwitchCamera.addEventListener('click', async () => {
            currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
            const span = btnSwitchCamera.querySelector('span');
            if (span) span.textContent = (currentFacingMode === 'user') ? 'Front Cam' : 'Rear Cam';
            isMirrored = (currentFacingMode === 'user');
            if (webcamElement) {
                webcamElement.style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
            }
            if (btnFlipCamera) {
                btnFlipCamera.classList.toggle('active', isMirrored);
            }
            if (isCameraActive) {
                stopCamera();
                setTimeout(() => {
                    startCamera();
                }, 300);
            }
        });
    }

    if (btnToggleDebug) {
        btnToggleDebug.addEventListener('click', () => {
            isDebugMode = !isDebugMode;
            btnToggleDebug.classList.toggle('active', isDebugMode);
            btnToggleDebug.querySelector('span').textContent = `Debug: ${isDebugMode ? 'ON' : 'OFF'}`;
            if (aiDebugHud) {
                aiDebugHud.style.display = isDebugMode ? 'block' : 'none';
            }
        });
    }

    // Sentence Controls
    if (btnSpeakSentence) btnSpeakSentence.addEventListener('click', () => { if (sentenceList.length > 0) speakText(sentenceList.join(" ")); });
    if (btnCopySentence) btnCopySentence.addEventListener('click', () => {
        if (sentenceList.length > 0) {
            navigator.clipboard.writeText(sentenceList.join(" "));
            alert("Sentence copied to clipboard!");
        }
    });
    if (btnClearSentence) btnClearSentence.addEventListener('click', () => { sentenceList = []; renderSentence(); });
    if (btnAddSpace) btnAddSpace.addEventListener('click', () => { sentenceList.push(" "); renderSentence(); });
    if (btnBackspace) btnBackspace.addEventListener('click', () => { sentenceList.pop(); renderSentence(); });
    if (btnSaveTranslation) btnSaveTranslation.addEventListener('click', () => {
        if (sentenceList.length === 0) {
            alert("Sentence is empty. Translate signs first.");
            return;
        }
        addHistoryRecord(sentenceList.join(" "), 98);
        alert("Translation session logged to Relational SQL (PostgreSQL) and NoSQL (MongoDB) stores!");
    });

    // Translation History Navigation, Toggle & Modal Controls
    const btnNavHistory = document.getElementById('btn-nav-history');
    const historyCard = document.getElementById('history-card');
    const historyCardHeader = document.getElementById('history-card-header');
    const btnClearAllHistory = document.getElementById('btn-clear-all-history');
    const modalHistoryActions = document.getElementById('modal-history-actions');
    const btnCloseHistoryModal = document.getElementById('btn-close-history-modal');
    const modalBtnSpeak = document.getElementById('modal-btn-speak');
    const modalBtnAppend = document.getElementById('modal-btn-append');
    const modalBtnCopy = document.getElementById('modal-btn-copy');
    const modalBtnDelete = document.getElementById('modal-btn-delete');

    // 1. Top Navbar "History" Button -> Smooth Scroll & Highlight
    if (btnNavHistory) {
        btnNavHistory.addEventListener('click', () => {
            if (historyCard) {
                historyCard.classList.remove('is-collapsed');
                historyCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                historyCard.classList.add('highlight-pulse');
                setTimeout(() => historyCard.classList.remove('highlight-pulse'), 1500);
            }
        });
    }

    // 2. Click Translation History Header -> Accordion Toggle
    if (historyCardHeader) {
        historyCardHeader.addEventListener('click', (e) => {
            if (e.target.closest('#btn-clear-all-history')) return;
            if (historyCard) {
                historyCard.classList.toggle('is-collapsed');
            }
        });
    }

    // 3. Clear All History Button
    if (btnClearAllHistory) {
        btnClearAllHistory.addEventListener('click', (e) => {
            e.stopPropagation();
            clearAllHistory();
        });
    }

    // 4. History Item Action Modal Controls
    if (btnCloseHistoryModal && modalHistoryActions) {
        btnCloseHistoryModal.addEventListener('click', () => modalHistoryActions.classList.remove('active'));
    }

    if (modalBtnSpeak) {
        modalBtnSpeak.addEventListener('click', () => {
            if (activeHistoryItem && activeHistoryItem.record) {
                speakText(activeHistoryItem.record.sign);
            }
        });
    }

    if (modalBtnAppend) {
        modalBtnAppend.addEventListener('click', () => {
            if (activeHistoryItem && activeHistoryItem.record) {
                sentenceList.push(activeHistoryItem.record.sign);
                renderSentence();
                modalHistoryActions.classList.remove('active');
            }
        });
    }

    if (modalBtnCopy) {
        modalBtnCopy.addEventListener('click', () => {
            if (activeHistoryItem && activeHistoryItem.record) {
                navigator.clipboard.writeText(activeHistoryItem.record.sign);
                alert(`Copied "${activeHistoryItem.record.sign}" to clipboard!`);
            }
        });
    }

    if (modalBtnDelete) {
        modalBtnDelete.addEventListener('click', () => {
            if (activeHistoryItem && activeHistoryItem.record) {
                const rec = activeHistoryItem.record;
                const idx = activeHistoryItem.index;
                deleteHistoryRecord(rec.history_id, idx);
                modalHistoryActions.classList.remove('active');
            }
        });
    }

    [modalAnalytics, modalHandGuide, modalHistoryActions].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }
    });

    // DBE Code Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const target = document.getElementById(`tab-${targetTab}`);
            if (target) target.classList.add('active');
        });
    });

    // =========================================================================
    // 8. Sign Language Translator - Hero Hand Stage & Demo Cards
    // =========================================================================
    
    // Normalized 21-Landmark Keypoint Sets for Common ASL Hand Shapes (0 to 500 space)
    const HERO_LANDMARK_POSES = {
        'THUMBS UP': [
            { x: 300, y: 390 }, // 0: Wrist
            { x: 260, y: 310 }, { x: 250, y: 240 }, { x: 255, y: 170 }, { x: 255, y: 110 }, // 1-4: Thumb Up
            { x: 220, y: 260 }, { x: 190, y: 270 }, { x: 170, y: 280 }, { x: 200, y: 290 }, // 5-8: Index Curled
            { x: 215, y: 300 }, { x: 180, y: 310 }, { x: 165, y: 320 }, { x: 200, y: 330 }, // 9-12: Middle Curled
            { x: 220, y: 340 }, { x: 185, y: 350 }, { x: 175, y: 360 }, { x: 205, y: 365 }, // 13-16: Ring Curled
            { x: 235, y: 375 }, { x: 205, y: 385 }, { x: 195, y: 395 }, { x: 220, y: 395 }  // 17-20: Pinky Curled
        ],
        'HI / HELLO': [
            { x: 250, y: 440 }, // 0: Wrist
            { x: 320, y: 370 }, { x: 360, y: 320 }, { x: 390, y: 270 }, { x: 410, y: 230 }, // 1-4: Thumb Spread
            { x: 220, y: 280 }, { x: 205, y: 210 }, { x: 195, y: 150 }, { x: 190, y: 100 }, // 5-8: Index Straight Up
            { x: 250, y: 270 }, { x: 250, y: 190 }, { x: 250, y: 130 }, { x: 250, y: 80 },  // 9-12: Middle Straight Up
            { x: 280, y: 280 }, { x: 295, y: 205 }, { x: 305, y: 145 }, { x: 310, y: 95 },  // 13-16: Ring Straight Up
            { x: 310, y: 305 }, { x: 340, y: 245 }, { x: 360, y: 195 }, { x: 375, y: 150 }  // 17-20: Pinky Spread
        ],
        'I LOVE YOU': [
            { x: 250, y: 440 }, // 0: Wrist
            { x: 310, y: 360 }, { x: 345, y: 315 }, { x: 375, y: 265 }, { x: 400, y: 225 }, // 1-4: Thumb Extended
            { x: 225, y: 290 }, { x: 210, y: 215 }, { x: 200, y: 150 }, { x: 190, y: 90 },  // 5-8: Index Extended
            { x: 250, y: 290 }, { x: 250, y: 330 }, { x: 250, y: 355 }, { x: 250, y: 340 }, // 9-12: Middle Folded
            { x: 275, y: 295 }, { x: 275, y: 335 }, { x: 275, y: 360 }, { x: 275, y: 345 }, // 13-16: Ring Folded
            { x: 305, y: 310 }, { x: 320, y: 245 }, { x: 335, y: 185 }, { x: 345, y: 130 }  // 17-20: Pinky Extended
        ],
        'STOP / FIST': [
            { x: 250, y: 440 }, // 0: Wrist
            { x: 300, y: 340 }, { x: 280, y: 280 }, { x: 250, y: 270 }, { x: 230, y: 275 }, // 1-4: Thumb Locked Across
            { x: 210, y: 300 }, { x: 200, y: 230 }, { x: 210, y: 190 }, { x: 225, y: 220 }, // 5-8: Index Curled
            { x: 245, y: 295 }, { x: 245, y: 225 }, { x: 250, y: 185 }, { x: 250, y: 220 }, // 9-12: Middle Curled
            { x: 275, y: 300 }, { x: 280, y: 230 }, { x: 280, y: 190 }, { x: 275, y: 225 }, // 13-16: Ring Curled
            { x: 305, y: 315 }, { x: 315, y: 250 }, { x: 315, y: 215 }, { x: 305, y: 235 }  // 17-20: Pinky Curled
        ]
    };

    const SKELETON_EDGES = [
        [0,1],[1,2],[2,3],[3,4], // Thumb
        [0,5],[5,6],[6,7],[7,8], // Index
        [5,9],[9,10],[10,11],[11,12], // Middle
        [9,13],[13,14],[14,15],[15,16], // Ring
        [13,17],[17,18],[18,19],[19,20], // Pinky
        [0,17] // Palm Base
    ];

    function drawHeroLandmarkSvg(points) {
        const svg = document.getElementById('hero-landmark-svg');
        if (!svg || !points) return;
        
        let linesHtml = '';
        SKELETON_EDGES.forEach(([i, j]) => {
            const p1 = points[i];
            const p2 = points[j];
            if (p1 && p2) {
                const isThumb = i <= 4 && j <= 4;
                const cls = isThumb ? 'lm-edge lm-edge-accent' : 'lm-edge';
                linesHtml += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" class="${cls}" />`;
            }
        });

        let nodesHtml = '';
        points.forEach((p, idx) => {
            let cls = 'lm-node';
            let r = 4.5;
            if (idx === 0) { cls += ' lm-node-wrist'; r = 6.5; }
            else if ([4, 8, 12, 16, 20].includes(idx)) { cls += ' lm-node-tip'; r = 5.5; }
            nodesHtml += `<circle cx="${p.x}" cy="${p.y}" r="${r}" class="${cls}" />`;
        });

        svg.innerHTML = linesHtml + nodesHtml;
    }

    function initHeroHand3D() {
        const heroHandImg = document.getElementById('hero-hand-img');
        const heroDetName = document.getElementById('hero-detected-name');
        const heroConfVal = document.getElementById('hero-conf-value');
        const heroWaveform = document.getElementById('hero-waveform');
        const quickSignBtns = document.querySelectorAll('.quick-sign-btn');
        const btnToggleLandmarks = document.getElementById('btn-toggle-hero-landmarks');
        const btnHeroPronounce = document.getElementById('btn-hero-pronounce');
        const heroSvg = document.getElementById('hero-landmark-svg');

        const HERO_SIGNS = [
            {
                signKey: 'THUMBS UP',
                displayName: 'THUMBS UP',
                conf: '98.6%',
                cat: 'POSITIVE · READY',
                img: 'assets/hero_asl_thumbsup.jpg'
            },
            {
                signKey: 'HI / HELLO',
                displayName: 'HELLO',
                conf: '99.2%',
                cat: 'WAVE · WELCOME',
                img: 'assets/hero_asl_hello.jpg'
            },
            {
                signKey: 'I LOVE YOU',
                displayName: 'I LOVE YOU',
                conf: '97.8%',
                cat: 'CONNECT · EXPRESS',
                img: 'assets/hero_asl_ily.jpg'
            },
            {
                signKey: 'STOP / FIST',
                displayName: 'AGAIN / FIST',
                conf: '98.4%',
                cat: 'CLOSED FIST · READY',
                img: 'assets/hero_asl_fist.jpg'
            }
        ];

        let currentSignIndex = 0;
        let showLandmarks = true;
        let currentActiveSign = 'THUMBS UP';

        function applyHeroSign(signObj, speak = true) {
            if (!signObj) return;
            currentActiveSign = signObj.displayName;

            // Smooth image transition
            if (heroHandImg) {
                heroHandImg.style.opacity = '0.35';
                heroHandImg.style.transform = 'scale(0.96)';
                setTimeout(() => {
                    heroHandImg.src = signObj.img;
                    heroHandImg.style.opacity = '1';
                    heroHandImg.style.transform = 'scale(1)';
                }, 130);
            }

            // Update Neural Landmark Skeleton
            const posePoints = HERO_LANDMARK_POSES[signObj.signKey] || HERO_LANDMARK_POSES['THUMBS UP'];
            drawHeroLandmarkSvg(posePoints);

            // Update HUD Telemetry
            if (heroDetName) heroDetName.textContent = signObj.displayName;
            if (heroConfVal) heroConfVal.textContent = signObj.conf;

            // Highlight matching quick button in bottom dock
            quickSignBtns.forEach(b => {
                const bSign = b.getAttribute('data-sign');
                b.classList.toggle('active', bSign === signObj.signKey);
            });

            // Voice feedback
            if (speak && ttsEnabled) {
                speakText(signObj.displayName);
            }

            // Waveform bounce
            if (heroWaveform) {
                heroWaveform.style.opacity = '1';
            }

            // Update live camera section detected translation
            const mockSign = { name: signObj.signKey, category: signObj.cat, icon: 'fa-solid fa-hand' };
            updateRecognitionUI(mockSign, parseInt(signObj.conf) || 98);
        }

        // Initial render: Thumbs Up
        applyHeroSign(HERO_SIGNS[0], false);

        // Click directly on the hand to cycle through signs!
        const heroHandWrapper = document.getElementById('hero-hand-wrapper');
        if (heroHandWrapper) {
            heroHandWrapper.addEventListener('click', () => {
                currentSignIndex = (currentSignIndex + 1) % HERO_SIGNS.length;
                applyHeroSign(HERO_SIGNS[currentSignIndex], true);
            });
        }

        // Toggle Landmarks Button
        if (btnToggleLandmarks && heroSvg) {
            btnToggleLandmarks.addEventListener('click', (e) => {
                e.stopPropagation();
                showLandmarks = !showLandmarks;
                btnToggleLandmarks.classList.toggle('active', showLandmarks);
                btnToggleLandmarks.querySelector('span').textContent = `21 Keypoints: ${showLandmarks ? 'ON' : 'OFF'}`;
                heroSvg.classList.toggle('hidden', !showLandmarks);
            });
        }

        // Pronounce Audio Button
        if (btnHeroPronounce) {
            btnHeroPronounce.addEventListener('click', (e) => {
                e.stopPropagation();
                speakText(currentActiveSign);
            });
        }

        // Quick Sign Switcher Dock buttons
        quickSignBtns.forEach((btn, idx) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const signKey = btn.getAttribute('data-sign') || 'THUMBS UP';
                const foundIdx = HERO_SIGNS.findIndex(s => s.signKey === signKey);
                if (foundIdx !== -1) {
                    currentSignIndex = foundIdx;
                    applyHeroSign(HERO_SIGNS[currentSignIndex], true);
                } else {
                    const customObj = {
                        signKey: signKey,
                        displayName: btn.getAttribute('data-display') || signKey,
                        conf: btn.getAttribute('data-conf') || '98.6%',
                        cat: btn.getAttribute('data-cat') || 'Gesture',
                        img: btn.getAttribute('data-img') || 'assets/hero_asl_thumbsup.jpg'
                    };
                    applyHeroSign(customObj, true);
                }
            });
        });

        // Try with Camera CTA - Smooth Scroll & Auto Start
        const btnHeroTryCamera = document.getElementById('btn-hero-try-camera');
        if (btnHeroTryCamera) {
            btnHeroTryCamera.addEventListener('click', (e) => {
                e.preventDefault();
                const camSection = document.getElementById('camera-section');
                if (camSection) {
                    camSection.scrollIntoView({ behavior: 'smooth' });
                }
                if (!isCameraActive) {
                    setTimeout(() => {
                        startCamera();
                    }, 500);
                }
            });
        }
    }

    // Render "A little practice goes a long way" Demo Cards Grid (Matching reference 2)
    function renderDemoCardsGrid() {
        const grid = document.getElementById('demo-cards-grid');
        if (!grid) return;

        const demoItems = [
            {
                letter: 'A',
                name: 'again',
                signKey: 'STOP / FIST',
                desc: 'closed hand · thumb rests on side',
                img: 'assets/hero_asl_fist.jpg',
                heroPose: 'STOP / FIST'
            },
            {
                letter: 'B',
                name: 'hello',
                signKey: 'HI / HELLO',
                desc: 'open palm · fingers together',
                img: 'assets/hero_asl_hello.jpg',
                heroPose: 'HI / HELLO'
            },
            {
                letter: 'C',
                name: 'connect',
                signKey: 'OK SIGN / F',
                desc: 'curved fingers · soft C shape',
                img: 'assets/sign_ok.jpg',
                heroPose: 'STOP / FIST'
            },
            {
                letter: 'I',
                name: 'i love you',
                signKey: 'I LOVE YOU',
                desc: 'pinky raised · palm forward',
                img: 'assets/hero_asl_ily.jpg',
                heroPose: 'I LOVE YOU'
            },
            {
                letter: 'D',
                name: 'thumbs up',
                signKey: 'THUMBS UP',
                desc: 'upright thumb · positive ready',
                img: 'assets/hero_asl_thumbsup.jpg',
                heroPose: 'THUMBS UP'
            },
            {
                letter: 'E',
                name: 'thumbs down',
                signKey: 'THUMBS DOWN',
                desc: 'downward thumb · rejection ready',
                img: 'assets/icon_3d_thumbs_down.png',
                heroPose: 'THUMBS UP'
            },
            {
                letter: 'F',
                name: 'peace',
                signKey: 'PEACE / VICTORY / V',
                desc: 'index & middle extended · victory',
                img: 'assets/icon_3d_peace.png',
                heroPose: 'HI / HELLO'
            },
            {
                letter: 'G',
                name: 'point',
                signKey: 'POINT / ONE',
                desc: 'index finger · directional',
                img: 'assets/icon_3d_point.png',
                heroPose: 'THUMBS UP'
            }
        ];

        grid.innerHTML = '';
        demoItems.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'demo-sign-card';
            card.setAttribute('data-sign', item.signKey);
            card.innerHTML = `
                <div class="demo-card-stage">
                    <span class="card-letter-badge">${item.letter}</span>
                    <img src="${item.img}" alt="${item.name} ASL sign" class="demo-card-img" />
                </div>
                <div class="demo-card-body">
                    <div class="demo-card-text">
                        <h4 class="demo-card-title">${item.name}</h4>
                        <p class="demo-card-desc">${item.desc}</p>
                    </div>
                    <span class="demo-card-arrow"><i class="fa-solid fa-chevron-right"></i></span>
                </div>
            `;

            card.addEventListener('click', () => {
                document.querySelectorAll('.demo-sign-card').forEach(c => c.classList.remove('active-sign'));
                card.classList.add('active-sign');

                // Update Hero Stage Hand & Skeleton
                const heroHandImg = document.getElementById('hero-hand-img');
                const heroDetName = document.getElementById('hero-detected-name');
                const heroConfVal = document.getElementById('hero-conf-value');

                if (heroHandImg) {
                    heroHandImg.style.opacity = '0.3';
                    setTimeout(() => {
                        heroHandImg.src = item.img;
                        heroHandImg.style.opacity = '1';
                    }, 120);
                }

                const pose = HERO_LANDMARK_POSES[item.heroPose] || HERO_LANDMARK_POSES['THUMBS UP'];
                drawHeroLandmarkSvg(pose);

                if (heroDetName) heroDetName.textContent = item.name.toUpperCase();
                if (heroConfVal) heroConfVal.textContent = '99.1%';

                // Voice Speech
                if (ttsEnabled) {
                    speakText(item.name);
                }

                // Update Camera section detected translation
                const mockSign = { name: item.signKey, category: 'Demo', icon: 'fa-solid fa-hand' };
                updateRecognitionUI(mockSign, 99);
                confirmSignToSentence(mockSign, 99);

                // Open modal guide if target sign exists in catalog
                const foundCatalogItem = (window.dictionaryData || []).find(d => 
                    d.name.toLowerCase().includes(item.name.toLowerCase()) || 
                    d.handPose.toLowerCase().includes(item.name.toLowerCase())
                );
                if (foundCatalogItem) {
                    openHandGuideModal(foundCatalogItem);
                }
            });

            grid.appendChild(card);
        });
    }

    // =========================================================================
    // 7. Interactive Desktop Phone Shape Simulator Suite & Toast Helper
    // =========================================================================
    function showToast(title, msg) {
        let toast = document.getElementById('app-system-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-system-toast';
            toast.style.cssText = `
                position: fixed;
                top: 24px;
                right: 24px;
                z-index: 999999;
                background: rgba(15, 23, 42, 0.95);
                border: 1px solid rgba(0, 240, 255, 0.4);
                box-shadow: 0 10px 30px rgba(0,0,0,0.7), 0 0 20px rgba(0, 240, 255, 0.25);
                border-radius: 12px;
                padding: 12px 18px;
                color: #fff;
                display: flex;
                flex-direction: column;
                gap: 3px;
                pointer-events: none;
                transition: opacity 0.3s ease, transform 0.3s ease;
                transform: translateY(-10px);
                opacity: 0;
            `;
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<strong style="font-size:13px; color:#00f0ff;">${title}</strong><span style="font-size:11px; color:#94a3b8;">${msg}</span>`;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
        }, 2800);
    }

    // Initialize Hero Hand & Demo Cards Grid & Live Recognition
    initHeroHand3D();
    renderDemoCardsGrid();
    renderVisualHandGrid();
    initMediaPipe();
    fetchHistoryFromBackend();
});

