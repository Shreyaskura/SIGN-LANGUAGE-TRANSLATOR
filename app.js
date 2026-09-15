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
    const btnQuickHi = document.getElementById('btn-quick-hi');

    // Display Labels
    const liveIndicator = document.getElementById('live-indicator');
    const fpsCounter = document.getElementById('fps-counter');
    const handCountLabel = document.getElementById('hand-count-label');
    const confidenceLabel = document.getElementById('confidence-label');
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
    let mediaStream = null;
    let handsInstance = null;
    let animFrameId = null;

    let sentenceList = [];
    let translationHistory = [];
    let sqlRecordCount = 1248;
    let mongoRecordCount = 8520;

    let activeGuideSign = null;
    let lastDetectedSign = "";
    let signHoldStartTime = 0;
    const CONFIRM_HOLD_DURATION_MS = 550;
    let isSignDebounced = false;

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
    window.getHandOrientation = function(item) {
        if (!item) return { view: 'palmar', image: 'assets/hand_palmar.png', label: 'Palm View', icon: 'fa-regular fa-hand' };
        const name = (item.name || '').toUpperCase();
        const pose = (item.handPose || '').toLowerCase();
        
        // Signs where the back of the hand or closed fist faces the camera/viewer:
        const isDorsal = name.includes('YES') || 
                         name.includes('NO') || 
                         name.includes('ROCK') || 
                         name === 'ALPHABET A' || 
                         name === 'ALPHABET E' || 
                         name === 'ALPHABET M' || 
                         name === 'ALPHABET N' || 
                         name === 'ALPHABET O' || 
                         name === 'ALPHABET S' || 
                         name === 'ALPHABET T' || 
                         pose === 'fist' || 
                         pose === 'rock_horns' || 
                         pose === 'alphabet_a';

        if (isDorsal) {
            return {
                view: 'dorsal',
                image: 'assets/hand_dorsal.png',
                label: 'Back View',
                icon: 'fa-solid fa-hand'
            };
        }

        // All other signs face palm-forward towards viewer or chin/mouth:
        return {
            view: 'palmar',
            image: 'assets/hand_palmar.png',
            label: 'Palm View',
            icon: 'fa-regular fa-hand'
        };
    };

    window.renderRealPhotoHand = function(item, isMini = false, speedClass = '') {
        if (!item) return '';
        const orientation = window.getHandOrientation(item);
        const name = (item.name || '').toUpperCase();
        const motion = item.motionClass || 'anim-real-pulse';

        // 1. Mini Preview for Reference Catalog Cards & Right Drawer Grid
        if (isMini) {
            return `
            <div class="mini-real-hand-preview" title="${item.name}: ${orientation.label}">
                <img src="${orientation.image}" alt="${item.name} Hand Model" class="mini-real-hand-img" />
                <span class="mini-orientation-tag">${orientation.view === 'palmar' ? 'Palm' : 'Back'}</span>
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
            return false;
        }

        if (!handsInstance) {
            if (handCountLabel) handCountLabel.textContent = "Loading AI Models...";
            handsInstance = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            handsInstance.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            handsInstance.onResults(onHandResults);
        }
        return true;
    }

    async function startCamera() {
        if (isCameraActive || !webcamElement) return;

        try {
            if (handCountLabel) handCountLabel.textContent = "Requesting Webcam...";
            
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
                audio: false
            });

            webcamElement.srcObject = mediaStream;
            await webcamElement.play();

            isCameraActive = true;
            initMediaPipe();

            if (cameraPlaceholder) cameraPlaceholder.classList.add('hidden');
            if (cameraBtnText) cameraBtnText.textContent = 'Stop Camera';
            if (btnToggleCamera) {
                btnToggleCamera.classList.remove('btn-primary');
                btnToggleCamera.classList.add('btn-secondary');
            }
            if (liveIndicator) liveIndicator.style.display = 'inline-flex';
            if (handCountLabel) handCountLabel.textContent = "Scanning for Hands...";

            speakText("Camera active. Ready for sign translation.");
            processVideoFrame();

        } catch (err) {
            console.error("Camera Access Error:", err);
            if (handCountLabel) handCountLabel.textContent = "Camera Error";
            alert("Unable to access camera. Please allow camera permissions in your browser address bar.");
        }
    }

    async function processVideoFrame() {
        if (!isCameraActive || !webcamElement) return;

        if (webcamElement.readyState >= 2 && handsInstance) {
            try {
                await handsInstance.send({ image: webcamElement });
            } catch (err) {
                console.error("MediaPipe Frame Error:", err);
            }
        }
        animFrameId = requestAnimationFrame(processVideoFrame);
    }

    function stopCamera() {
        isCameraActive = false;
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

        canvasElement.width = webcamElement.videoWidth || 640;
        canvasElement.height = webcamElement.videoHeight || 480;

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (isMirrored) {
            canvasCtx.translate(canvasElement.width, 0);
            canvasCtx.scale(-1, 1);
        }

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const numHands = results.multiHandLandmarks.length;
            if (handCountLabel) handCountLabel.textContent = `${numHands} Hand${numHands > 1 ? 's' : ''} Detected`;

            const primaryLandmarks = results.multiHandLandmarks[0];
            const handScore = results.multiHandedness && results.multiHandedness[0] 
                ? Math.round(results.multiHandedness[0].score * 100) 
                : 96;
            if (confidenceLabel) confidenceLabel.textContent = `Confidence: ${handScore}%`;

            if (drawSkeleton && typeof drawConnectors !== 'undefined') {
                for (const landmarks of results.multiHandLandmarks) {
                    drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#2563eb', lineWidth: 3 });
                    drawLandmarks(canvasCtx, landmarks, {
                        color: '#1d4ed8',
                        fillColor: '#93c5fd',
                        radius: (data) => [4, 8, 12, 16, 20].includes(data.index) ? 6 : 3.5
                    });
                }
            }

            const recognized = classifyHandGesture(primaryLandmarks, numHands);
            updateRecognitionUI(recognized, handScore);

        } else {
            if (handCountLabel) handCountLabel.textContent = 'No Hand Detected';
            if (confidenceLabel) confidenceLabel.textContent = 'Confidence: 0%';
            resetCurrentSignDisplay();
        }

        canvasCtx.restore();
    }

    // =========================================================================
    // 4. Comprehensive 21-Landmark ASL Gesture Classifier (Detects ALL Signs)
    // =========================================================================
    function classifyHandGesture(lm, numHands = 1) {
        const wrist = lm[0];

        function dist(p1, p2) {
            return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        }

        // Scale-normalized distance (invariant to webcam distance)
        const palmSize = Math.max(0.04, dist(lm[0], lm[9]));

        // Detect extension of individual fingers:
        // Finger tip distance to wrist vs PIP distance to wrist:
        const isIndexExt = dist(lm[8], wrist) > dist(lm[6], wrist) * 1.08 && dist(lm[8], lm[5]) > dist(lm[6], lm[5]) * 1.25;
        const isMiddleExt = dist(lm[12], wrist) > dist(lm[10], wrist) * 1.08 && dist(lm[12], lm[9]) > dist(lm[10], lm[9]) * 1.25;
        const isRingExt = dist(lm[16], wrist) > dist(lm[14], wrist) * 1.08 && dist(lm[16], lm[13]) > dist(lm[14], lm[13]) * 1.25;
        const isPinkyExt = dist(lm[20], wrist) > dist(lm[18], wrist) * 1.08 && dist(lm[20], lm[17]) > dist(lm[18], lm[17]) * 1.25;

        // Thumb extension:
        const thumbTipWrist = dist(lm[4], wrist);
        const indexMcpWrist = dist(lm[5], wrist);
        const isThumbExt = thumbTipWrist > indexMcpWrist * 0.95 && dist(lm[4], lm[2]) > dist(lm[3], lm[2]) * 1.15;

        // Thumb upright:
        const isThumbUp = lm[4].y < lm[2].y && ((wrist.y - lm[4].y) / palmSize > 0.45);

        // Relative inter-finger distances:
        const thumbIndexDist = dist(lm[4], lm[8]) / palmSize;
        const thumbMiddleDist = dist(lm[4], lm[12]) / palmSize;
        const indexMiddleSpread = dist(lm[8], lm[12]) / palmSize;
        const middleRingSpread = dist(lm[12], lm[16]) / palmSize;

        const extendedCount = [isIndexExt, isMiddleExt, isRingExt, isPinkyExt].filter(Boolean).length;

        // 1. I LOVE YOU (🤟) vs ROCK / METAL (🤘)
        if (isIndexExt && isPinkyExt && !isMiddleExt && !isRingExt) {
            if (isThumbExt) {
                return { name: "I LOVE YOU", category: "Common", icon: "fa-hand-spock", confidence: 98 };
            } else {
                return { name: "ROCK / METAL", category: "Common", icon: "fa-hand-back-fist", confidence: 96 };
            }
        }

        // 2. THUMBS UP vs HELP
        if (extendedCount === 0 && isThumbUp) {
            if (numHands >= 2) {
                return { name: "HELP", category: "Emergency", icon: "fa-hand-holding-medical", confidence: 99 };
            } else {
                return { name: "THUMBS UP", category: "Common", icon: "fa-thumbs-up", confidence: 99 };
            }
        }

        // 3. ALPHABET L (Thumb & Index at ~90 degrees, others folded)
        if (isIndexExt && isThumbExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
            return { name: "ALPHABET L", category: "Alphabet", icon: "fa-hand-lizard", confidence: 97 };
        }

        // 4. ALPHABET Y / CALL ME (Thumb & Pinky extended, middle 3 folded)
        if (isPinkyExt && isThumbExt && !isIndexExt && !isMiddleExt && !isRingExt) {
            return { name: "ALPHABET Y", category: "Alphabet", icon: "fa-hand-spock", confidence: 97 };
        }

        // 5. ALPHABET I (Only Pinky extended upward)
        if (isPinkyExt && !isThumbExt && !isIndexExt && !isMiddleExt && !isRingExt) {
            return { name: "ALPHABET I", category: "Alphabet", icon: "fa-font", confidence: 96 };
        }

        // 6. ALPHABET X (Index hooked/bent, others folded)
        const isIndexHooked = !isIndexExt && dist(lm[8], lm[5]) > 0.08 && lm[8].y > lm[6].y && !isMiddleExt && !isRingExt && !isPinkyExt;
        if (isIndexHooked) {
            return { name: "ALPHABET X", category: "Alphabet", icon: "fa-font", confidence: 95 };
        }

        // 7. POINT / NUMBER 1 vs ALPHABET D
        if (isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
            if (thumbMiddleDist < 0.35) {
                return { name: "ALPHABET D", category: "Alphabet", icon: "fa-font", confidence: 95 };
            } else {
                return { name: "POINT / ONE", category: "Numbers", icon: "fa-hand-pointer", confidence: 97 };
            }
        }

        // 8. NUMBER 2 vs PEACE / V vs ALPHABET U
        if (isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt) {
            if (indexMiddleSpread > 0.28) {
                return { name: "PEACE / VICTORY / V", category: "Common", icon: "fa-hand-peace", confidence: 98 };
            } else {
                return { name: "ALPHABET U", category: "Alphabet", icon: "fa-font", confidence: 95 };
            }
        }

        // 9. NUMBER 3 (Thumb, Index, Middle extended)
        if (isIndexExt && isMiddleExt && isThumbExt && !isRingExt && !isPinkyExt) {
            return { name: "THREE", category: "Numbers", icon: "fa-hand-dots", confidence: 96 };
        }

        // 10. WATER / ALPHABET W (Index, Middle, Ring extended in W)
        if (isIndexExt && isMiddleExt && isRingExt && !isPinkyExt) {
            return { name: "WATER / ALPHABET W", category: "Daily Needs", icon: "fa-glass-water", confidence: 98 };
        }

        // 11. NUMBER 4 vs ALPHABET B
        if (isIndexExt && isMiddleExt && isRingExt && isPinkyExt && !isThumbExt) {
            if (indexMiddleSpread < 0.20) {
                return { name: "ALPHABET B", category: "Alphabet", icon: "fa-hand", confidence: 97 };
            } else {
                return { name: "FOUR", category: "Numbers", icon: "fa-hand", confidence: 96 };
            }
        }

        // 12. OPEN 5 FINGERS: HI / HELLO vs THANK YOU vs PLEASE vs FIVE
        if (extendedCount >= 4 && isThumbExt) {
            const isFingersTogether = indexMiddleSpread < 0.22 && middleRingSpread < 0.22;
            const isNearChin = lm[8].y < 0.35 && wrist.y < 0.50;

            if (isFingersTogether && isNearChin) {
                return { name: "THANK YOU", category: "Greetings", icon: "fa-hands-clapping", confidence: 98 };
            } else if (isFingersTogether && wrist.y >= 0.45 && wrist.y <= 0.85) {
                return { name: "PLEASE", category: "Expressions", icon: "fa-heart", confidence: 96 };
            } else {
                return { name: "HI / HELLO", category: "Greetings", icon: "fa-hand-wave", confidence: 99 };
            }
        }

        // 13. OK SIGN / ALPHABET F (Thumb & Index tips touching, 3 fingers extended)
        if (thumbIndexDist < 0.35 && isMiddleExt && isRingExt && isPinkyExt) {
            return { name: "OK SIGN / F", category: "Common", icon: "fa-hand-holding-heart", confidence: 97 };
        }

        // 14. ALPHABET C (Curved hand in C shape)
        if (thumbIndexDist >= 0.35 && thumbIndexDist <= 0.85 && !isPinkyExt && dist(lm[8], lm[5]) / palmSize < 0.65) {
            return { name: "ALPHABET C", category: "Alphabet", icon: "fa-copyright", confidence: 95 };
        }

        // 15. ALPHABET O / ZERO (Fingertips touching thumb tip in closed loop)
        if (thumbIndexDist < 0.28 && !isMiddleExt && !isRingExt && !isPinkyExt) {
            return { name: "ALPHABET O / ZERO", category: "Alphabet", icon: "fa-circle-notch", confidence: 96 };
        }

        // 16. NO (Index, Middle, and Thumb tips snapping together)
        if (thumbIndexDist < 0.30 && thumbMiddleDist < 0.32 && !isRingExt && !isPinkyExt) {
            return { name: "NO", category: "Expressions", icon: "fa-circle-xmark", confidence: 96 };
        }

        // 17. ZERO EXTENDED FINGERS (Fist shapes: SORRY, ALPHABET A, YES, STOP)
        if (extendedCount === 0) {
            if (dist(lm[4], lm[6]) / palmSize < 0.40) {
                return { name: "SORRY", category: "Expressions", icon: "fa-face-sad-tear", confidence: 96 };
            } else if (dist(lm[4], lm[5]) / palmSize < 0.50 && lm[4].y < lm[3].y) {
                return { name: "ALPHABET A", category: "Alphabet", icon: "fa-font", confidence: 95 };
            } else if (dist(lm[4], lm[10]) / palmSize < 0.42) {
                return { name: "YES", category: "Expressions", icon: "fa-circle-check", confidence: 95 };
            } else {
                return { name: "STOP / FIST", category: "Common", icon: "fa-hand-fist", confidence: 94 };
            }
        }

        return { name: "RECOGNIZING...", category: "Analyzing", icon: "fa-hand-dots", confidence: 60 };
    }

    function updateRecognitionUI(recognized, handScore) {
        if (!currentSignName) return;

        if (!recognized || recognized.name === "RECOGNIZING...") {
            currentSignName.textContent = "Analyzing Gesture...";
            currentSignName.classList.add('empty-state');
            if (currentSignDesc) currentSignDesc.textContent = "Move hand closer to camera";
            if (confidenceFill) confidenceFill.style.width = `45%`;
            if (confidencePercent) confidencePercent.textContent = `45%`;
            return;
        }

        currentSignName.textContent = recognized.name;
        currentSignName.classList.remove('empty-state');
        if (currentSignDesc) currentSignDesc.textContent = `Category: ${recognized.category} • Tracking: ${handScore}%`;
        if (signIconDisplay) signIconDisplay.innerHTML = `<i class="fa-solid ${recognized.icon}"></i>`;

        const totalConfidence = Math.min(99, Math.round((recognized.confidence + handScore) / 2));
        if (confidenceFill) confidenceFill.style.width = `${totalConfidence}%`;
        if (confidencePercent) confidencePercent.textContent = `${totalConfidence}%`;

        const currentTime = performance.now();
        if (recognized.name === lastDetectedSign) {
            if (!isSignDebounced && (currentTime - signHoldStartTime) >= CONFIRM_HOLD_DURATION_MS) {
                confirmSignToSentence(recognized, totalConfidence);
                isSignDebounced = true;
            }
        } else {
            lastDetectedSign = recognized.name;
            signHoldStartTime = currentTime;
            isSignDebounced = false;
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

    function addHistoryRecord(signName, confidence) {
        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        sqlRecordCount += 1;
        mongoRecordCount += 30;
        if (statSqlCount) statSqlCount.textContent = sqlRecordCount.toLocaleString();
        if (statMongoCount) statMongoCount.textContent = mongoRecordCount.toLocaleString();

        const record = {
            time: timeString,
            sign: signName,
            confidence: `${confidence}%`,
            dbSynced: true
        };

        translationHistory.unshift(record);
        renderHistoryTable();
    }

    function renderHistoryTable() {
        if (!historyTableBody) return;
        if (historyCount) historyCount.textContent = `${translationHistory.length} Record${translationHistory.length !== 1 ? 's' : ''}`;

        if (translationHistory.length === 0) {
            historyTableBody.innerHTML = `<tr class="no-data-row"><td colspan="4">No translations logged yet in this session.</td></tr>`;
            return;
        }

        historyTableBody.innerHTML = translationHistory.slice(0, 10).map(rec => `
            <tr>
                <td><i class="fa-regular fa-clock" style="color: var(--text-muted); margin-right: 4px;"></i> ${rec.time}</td>
                <td><strong>${rec.sign}</strong></td>
                <td><span class="badge badge-fps">${rec.confidence}</span></td>
                <td><span class="badge badge-dbs"><i class="fa-solid fa-check" style="color: var(--accent-emerald);"></i> Synced</span></td>
            </tr>
        `).join('');
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
        if (!modalHandGuide) return;
        activeGuideSign = item;

        if (guideModalTitle) guideModalTitle.textContent = `How to Form Sign: ${item.name}`;
        if (guideCategoryBadge) guideCategoryBadge.textContent = item.category;

        // Render Realistic Animated Human Demonstrator
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
            "Form the exact finger configuration shown in the human animation.",
            "Hold steady for 0.5 seconds to trigger auto-translation and voice speech."
        ];
        if (guideStepsList) {
            guideStepsList.innerHTML = steps.map(st => `<li>${st}</li>`).join('');
        }

        setInstructorTab('human');
        modalHandGuide.classList.add('active');
    }

    function renderInstructorStage(item) {
        if (!guideHumanStage) return;

        const speedClass = instructorSpeed === 'slow-motion' ? 'slow-motion' : '';
        const bodyPos = item.bodyPosition || 'Front of Camera';
        const bodyTag = `<div class="body-placement-indicator"><i class="fa-solid fa-location-dot"></i> ${bodyPos}</div>`;
        const orientation = window.getHandOrientation ? window.getHandOrientation(item) : { label: 'Front View', view: 'palmar' };

        guideHumanStage.innerHTML = `
            ${bodyTag}
            <div class="threed-drag-hint">
                <i class="fa-solid fa-arrows-spin"></i> 360° Drag
            </div>
            <div id="hand-3d-viewport" class="hand-3d-viewport"></div>
            <div class="threed-camera-pills">
                <button type="button" class="threed-cam-btn ${orientation.view === 'palmar' ? 'active' : ''}" id="btn-cam-front" title="Front (Palm) View">
                    <i class="fa-regular fa-hand"></i> Front
                </button>
                <button type="button" class="threed-cam-btn ${orientation.view === 'dorsal' ? 'active' : ''}" id="btn-cam-back" title="Back (Dorsal) View">
                    <i class="fa-solid fa-hand"></i> Back
                </button>
                <button type="button" class="threed-cam-btn" id="btn-cam-iso" title="3D Perspective Angle">
                    <i class="fa-solid fa-cube"></i> 3D Angle
                </button>
            </div>
        `;

        const viewport = document.getElementById('hand-3d-viewport');
        if (viewport && window.Hand3D) {
            window.Hand3D.init(viewport);
            window.Hand3D.displaySign(item, speedClass);

            const btnCamFront = document.getElementById('btn-cam-front');
            const btnCamBack = document.getElementById('btn-cam-back');
            const btnCamIso = document.getElementById('btn-cam-iso');

            const setCamBtnActive = (activeBtn) => {
                [btnCamFront, btnCamBack, btnCamIso].forEach(b => { if (b) b.classList.remove('active'); });
                if (activeBtn) activeBtn.classList.add('active');
            };

            if (btnCamFront) btnCamFront.addEventListener('click', (e) => {
                e.stopPropagation();
                setCamBtnActive(btnCamFront);
                window.Hand3D.setCameraView('front');
            });

            if (btnCamBack) btnCamBack.addEventListener('click', (e) => {
                e.stopPropagation();
                setCamBtnActive(btnCamBack);
                window.Hand3D.setCameraView('back');
            });

            if (btnCamIso) btnCamIso.addEventListener('click', (e) => {
                e.stopPropagation();
                setCamBtnActive(btnCamIso);
                window.Hand3D.setCameraView('iso');
            });
        } else if (viewport && window.renderRealPhotoHand) {
            viewport.innerHTML = window.renderRealPhotoHand(item, false, speedClass);
        }

        // Also draw skeleton canvas
        if (guideSkeletonCanvas) {
            drawLandmarkSkeletonDiagram(guideSkeletonCanvas, item);
        }
    }

    // Modal tabs: 3D Hand Model vs Photo Model vs Keypoints
    function setInstructorTab(tab) {
        instructorMode = tab;
        [btnModeHuman, btnModePhoto, btnModeSkeleton].forEach(b => { if (b) b.classList.remove('active'); });
        [guideHumanStage, guidePhotoWrapper, guideSkeletonWrapper].forEach(w => { if (w) w.classList.remove('active'); });

        if (tab === 'human') {
            if (btnModeHuman) btnModeHuman.classList.add('active');
            if (guideHumanStage) guideHumanStage.classList.add('active');
            if (window.Hand3D && activeGuideSign) {
                setTimeout(() => {
                    const viewport = document.getElementById('hand-3d-viewport');
                    if (viewport && !viewport.querySelector('canvas')) {
                        window.Hand3D.init(viewport);
                        window.Hand3D.displaySign(activeGuideSign, instructorSpeed === 'slow-motion' ? 'slow-motion' : '');
                    }
                }, 50);
            }
        } else if (tab === 'photo') {
            if (btnModePhoto) btnModePhoto.classList.add('active');
            if (guidePhotoWrapper) guidePhotoWrapper.classList.add('active');
        } else if (tab === 'skeleton') {
            if (btnModeSkeleton) btnModeSkeleton.classList.add('active');
            if (guideSkeletonWrapper) guideSkeletonWrapper.classList.add('active');
            if (activeGuideSign && guideSkeletonCanvas) {
                drawLandmarkSkeletonDiagram(guideSkeletonCanvas, activeGuideSign);
            }
        }
    }

    if (btnModeHuman) btnModeHuman.addEventListener('click', () => setInstructorTab('human'));
    if (btnModePhoto) btnModePhoto.addEventListener('click', () => setInstructorTab('photo'));
    if (btnModeSkeleton) btnModeSkeleton.addEventListener('click', () => setInstructorTab('skeleton'));

    // Playback Speed Controls
    if (btnSpeedNormal && btnSpeedSlow) {
        btnSpeedNormal.addEventListener('click', () => {
            instructorSpeed = 'normal';
            btnSpeedNormal.classList.add('active');
            btnSpeedSlow.classList.remove('active');
            if (window.Hand3D) window.Hand3D.playbackSpeed = 1.0;
            if (activeGuideSign) renderInstructorStage(activeGuideSign);
        });

        btnSpeedSlow.addEventListener('click', () => {
            instructorSpeed = 'slow-motion';
            btnSpeedSlow.classList.add('active');
            btnSpeedNormal.classList.remove('active');
            if (window.Hand3D) window.Hand3D.playbackSpeed = 0.5;
            if (activeGuideSign) renderInstructorStage(activeGuideSign);
        });
    }

    // Replay Animation
    if (btnReplayAnim) {
        btnReplayAnim.addEventListener('click', () => {
            if (activeGuideSign) {
                if (window.Hand3D) window.Hand3D.displaySign(activeGuideSign, instructorSpeed === 'slow-motion' ? 'slow-motion' : '');
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
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  item.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  item.category.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="no-data-row" style="grid-column: 1/-1;"><p>No signs found matching search.</p></div>`;
            return;
        }

        filtered.forEach((item, idx) => {
            const card = document.createElement('div');
            card.className = 'side-sign-card glass-panel';
            const cleanGuide = (item.handGuide || 'Hand Gesture').replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();

            card.innerHTML = `
                <div class="card-visual-header">
                    <div class="card-human-preview" title="Real hand posture demo">
                        ${window.renderRealPhotoHand(item, true)}
                    </div>
                    <div class="card-title-box">
                        <div>
                            <h3>${item.name}</h3>
                            <span class="badge badge-mode">${item.category}</span>
                        </div>
                    </div>
                </div>

                <div class="hand-guide-pill">
                    <i class="fa-solid ${item.icon}"></i> <span>Position: <strong>${cleanGuide}</strong></span>
                </div>

                <p class="sign-card-desc">${item.desc}</p>

                <div class="sign-card-actions-row">
                    <button class="btn btn-sm btn-secondary btn-open-hand-demo" data-index="${idx}">
                        <i class="fa-solid fa-hand"></i> Real Hand Demo
                    </button>
                    <button class="btn btn-sm btn-primary btn-test-hand-sign" data-sign="${item.name}" data-category="${item.category}" data-icon="${item.icon}">
                        <i class="fa-solid fa-play"></i> Test Sign
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });

        document.querySelectorAll('.btn-open-hand-demo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.getAttribute('data-index'), 10);
                const targetSign = filtered[index];
                if (targetSign) openHandGuideModal(targetSign);
            });
        });

        document.querySelectorAll('.btn-test-hand-sign').forEach(btn => {
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

    // Modal Guide Actions
    if (btnCloseHandGuide && modalHandGuide) {
        btnCloseHandGuide.addEventListener('click', () => modalHandGuide.classList.remove('active'));
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
            btnToggleSkeleton.querySelector('span').textContent = `Skeleton: ${drawSkeleton ? 'ON' : 'OFF'}`;
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

    // Modals
    if (btnAnalytics && modalAnalytics) btnAnalytics.addEventListener('click', () => modalAnalytics.classList.add('active'));
    if (btnCloseAnalytics && modalAnalytics) btnCloseAnalytics.addEventListener('click', () => modalAnalytics.classList.remove('active'));

    [modalAnalytics, modalHandGuide].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
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

    // Dictionary Filter & Search
    const dictSearch = document.getElementById('dict-search');
    const categoryPills = document.getElementById('category-pills');

    if (dictSearch && categoryPills) {
        dictSearch.addEventListener('input', (e) => {
            const activePill = categoryPills.querySelector('.pill.active');
            const cat = activePill ? activePill.getAttribute('data-category') : 'all';
            renderVisualHandGrid(cat, e.target.value);
        });

        categoryPills.addEventListener('click', (e) => {
            if (e.target.classList.contains('pill')) {
                categoryPills.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                const cat = e.target.getAttribute('data-category');
                renderVisualHandGrid(cat, dictSearch.value);
            }
        });
    }

    renderVisualHandGrid();
});
