import { supabase } from './supabase-config.js';
import { SCHEMA } from './supabase-config.js';

// Quiz state
let currentQuestionIndex = 0;
let score = 0;
let totalQuestions = 0;
let userAnswers = [];
let allQuestions = [];
let currentSoalType = 'pilihan_ganda';

// DOM Elements (set by calling code)
let quizContainer = null;
let questionCard = null;
let questionNum = null;
let questionText = null;
let optionsContainer = null;
let resultContainer = null;
let scoreDisplay = null;
let resultCard = null;

// Initialize quiz
export function initKuis() {
    // Check if we're on a quiz page
    quizContainer = document.getElementById('quiz-container');
    resultContainer = document.getElementById('result-container');
    if (!quizContainer) return;

    loadQuestions();
    setupEventListeners();
}

// Load questions from Supabase
export async function loadQuestions() {
    const { data, error } = await supabase
        .from(SCHEMA.TABLES.QUESTIONS)
        .select('*');

    if (error) {
        console.error('Gagal memuat soal:', error);
        showError('Gagal memuat soal dari database');
        return;
    }

    allQuestions = data || [];
    totalQuestions = allQuestions.length;
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];

    // Determine soal type from first question
    if (totalQuestions > 0) {
        currentSoalType = allQuestions[0].tipe_soal;
        renderQuestion();
    } else {
        showError('Tidak ada soal yang tersedia');
    }
}

// Render current question using createElement + appendChild only
export function renderQuestion() {
    // Clear previous question card using removeChild
    if (questionCard && questionCard.parentElement) {
        questionCard.parentElement.removeChild(questionCard);
    }

    if (currentQuestionIndex >= totalQuestions) {
        showResult();
        return;
    }

    const questionData = allQuestions[currentQuestionIndex];

    // Create question card using createElement
    questionCard = document.createElement('div');
    questionCard.className = 'question-card';
    questionCard.style.cssText = `
        background: var(--card-bg);
        padding: 2rem;
        border-radius: 15px;
        margin-bottom: 1rem;
        border-left: 4px solid var(--primary-color);
    `;

    // Create question number using createElement + textContent
    questionNum = document.createElement('div');
    questionNum.className = 'question-number';
    questionNum.textContent = `Soal ${currentQuestionIndex + 1} dari ${totalQuestions}`;
    questionNum.style.cssText = `
        color: var(--primary-color);
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
    `;

    // Create question text using createElement + textContent
    questionText = document.createElement('h3');
    questionText.textContent = questionData.pertanyaan;
    questionText.style.cssText = `
        font-size: 1.2rem;
        margin: 0.5rem 0;
        color: var(--text-color);
    `;

    // Create options container using createElement
    optionsContainer = document.createElement('div');
    optionsContainer.style.cssText = `
        margin-top: 1rem;
    `;

    // Render options based on soal type
    if (questionData.tipe_soal === SCHEMA.TIPE_SOAL.PILIHAN_GANDA) {
        renderPilihanGandaOptions(questionData);
    } else {
        renderEssayOptions(questionData);
    }

    // Append elements to question card using appendChild
    questionCard.appendChild(questionNum);
    questionCard.appendChild(questionText);
    questionCard.appendChild(optionsContainer);

    // Append to quiz container using appendChild
    quizContainer.appendChild(questionCard);
}

// Render pilihan ganda options using createElement
function renderPilihanGandaOptions(questionData) {
    const options = ['opsi_a', 'opsi_b', 'opsi_c', 'opsi_d'].map(key => questionData[key]);

    for (let i = 0; i < options.length; i++) {
        const option = options[i];
        const isSelected = userAnswers[currentQuestionIndex] === i;

        const optionLabel = document.createElement('label');
        optionLabel.className = 'option-label';
        optionLabel.style.cssText = `
            display: block;
            margin: 0.5rem 0;
            padding: 0.8rem;
            background: var(--bg-light);
            border-radius: 8px;
            cursor: pointer;
        `;

        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.name = `soal-${currentQuestionIndex}`;
        radioInput.value = i;
        radioInput.checked = isSelected;
        radioInput.style.display = 'none';

        const radioSpan = document.createElement('span');
        radioSpan.textContent = String.fromCharCode(65 + i) + '. ' + option;
        radioSpan.style.cssText = `
            font-size: 1rem;
            color: var(--text-color);
        `;

        // Append radio and span to label using appendChild
        optionLabel.appendChild(radioInput);
        optionLabel.appendChild(radioSpan);

        // Add click handler
        optionLabel.addEventListener('click', () => {
            selectAnswer(i);
        });

        // Append label to optionsContainer using appendChild
        optionsContainer.appendChild(optionLabel);
    }
}

// Render essay options (textarea) using createElement
function renderEssayOptions(questionData) {
    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.placeholder = 'Jawaban esai Anda...';
    textarea.value = userAnswers[currentQuestionIndex] || '';
    textarea.style.cssText = `
        width: 100%;
        padding: 0.8rem;
        margin: 0.5rem 0;
        background: var(--bg-light);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        color: var(--text-color);
        font-size: 1rem;
    `;

    textarea.addEventListener('input', (e) => {
        userAnswers[currentQuestionIndex] = e.target.value;
    });

    // Append textarea to optionsContainer using appendChild
    optionsContainer.appendChild(textarea);
}

// Select answer handler
function selectAnswer(index) {
    userAnswers[currentQuestionIndex] = index;

    // Highlight selected option
    const radios = document.querySelectorAll(`input[name="soal-${currentQuestionIndex}"]`);
    radios.forEach((radio, i) => {
        const label = radio.parentElement;
        if (i === index) {
            label.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
        } else {
            label.style.backgroundColor = 'var(--bg-light)';
        }
    });
}

// Setup event listeners using createElement patterns
function setupEventListeners() {
    // Next button
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const hasAnswer = currentSoalType === SCHEMA.TIPE_SOAL.PILIHAN_GANDA
                ? document.querySelector(`input[name="soal-${currentQuestionIndex}"]:checked`)
                : userAnswers[currentQuestionIndex] && userAnswers[currentQuestionIndex].length > 0;

            if (hasAnswer || currentSoalType === SCHEMA.TIPE_SOAL.ESSAY) {
                nextQuestion();
            }
        });
    }
}

// Move to next question
export function nextQuestion() {
    if (currentQuestionIndex < totalQuestions - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        showResult();
    }
}

// Show quiz result using createElement
export function showResult() {
    // Calculate score for pilihan ganda
    let benar = 0;
    let totalJawab = 0;

    for (let i = 0; i < totalQuestions; i++) {
        const questionData = allQuestions[i];
        const userAnswer = userAnswers[i];

        if (currentSoalType === SCHEMA.TIPE_SOAL.PILIHAN_GANDA) {
            if (userAnswer !== undefined && userAnswer !== null) {
                totalJawab++;
                if (userAnswer === questionData.jawaban_benar) {
                    benar++;
                }
            }
        } else {
            // For essay, just count as answered
            totalJawab++;
        }
    }

    // Hide quiz container using removeChild
    if (quizContainer && quizContainer.parentElement) {
        quizContainer.parentElement.removeChild(quizContainer);
    }

    // Clear result container using createElement removeAllChildren
    clearElement(resultContainer);

    resultContainer.style.display = 'block';

    const percentage = totalJawab > 0 ? (benar / totalJawab * 100).toFixed(1) : 0;

    // Create result card using createElement
    resultCard = document.createElement('div');
    resultCard.className = 'result-card';
    resultCard.style.cssText = `
        background: var(--card-bg);
        padding: 2rem;
        border-radius: 15px;
        text-align: center;
    `;

    const resultTitle = document.createElement('h2');
    resultTitle.textContent = 'Quiz Selesai!';
    resultTitle.style.cssText = `
        color: var(--primary-color);
        margin-bottom: 1rem;
    `;

    const scoreD = document.createElement('div');
    scoreD.textContent = `${benar} dari ${totalJawab} soal benar`;
    scoreD.style.cssText = `
        font-size: 2rem;
        margin: 1rem 0;
    `;

    const percentageDisplay = document.createElement('div');
    percentageDisplay.textContent = `Skor: ${percentage}%`;
    percentageDisplay.style.cssText = `
        font-size: 1.2rem;
        color: var(${percentage >= 80 ? 'success' : 'primary'}-color);
        margin: 1rem 0;
    `;

    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'Mainkan Lagi';
    restartBtn.style.cssText = `
        padding: 0.8rem 1.5rem;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 30px;
        cursor: pointer;
        font-size: 1rem;
    `;

    restartBtn.addEventListener('click', () => {
        restartQuiz();
    });

    const kembaliBtn = document.createElement('button');
    kembaliBtn.textContent = 'Kembali ke Beranda';
    kembaliBtn.style.cssText = `
        padding: 0.8rem 1.5rem;
        background: var(--bg-light);
        color: var(--text-color);
        border: none;
        border-radius: 30px;
        cursor: pointer;
        font-size: 1rem;
    `;

    kembaliBtn.addEventListener('click', () => {
        window.location.href = 'html/user/user-beranda.html';
    });

    // Append elements to resultCard using appendChild
    resultCard.appendChild(resultTitle);
    resultCard.appendChild(scoreD);
    resultCard.appendChild(percentageDisplay);
    resultCard.appendChild(restartBtn);
    resultCard.appendChild(kembaliBtn);

    // Append resultCard to resultContainer using appendChild
    resultContainer.appendChild(resultCard);
}

// Helper function to clear all children of an element
function clearElement(el) {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
}

// Restart quiz using createElement
export function restartQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    allQuestions = [];
    totalQuestions = 0;
    currentSoalType = 'pilihan_ganda';

    // Remove quiz container using removeChild
    if (quizContainer && quizContainer.parentElement) {
        quizContainer.parentElement.removeChild(quizContainer);
    }
    // Clear result container using clearElement
    clearElement(resultContainer);
    resultContainer.style.display = 'none';

    loadQuestions();
}

// Show error message using createElement
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        color: var(--accent-color);
        padding: 1rem;
        background: rgba(236, 72, 153, 0.1);
        border-radius: 8px;
        margin: 1rem 0;
    `;

    if (quizContainer && quizContainer.parentElement) {
        quizContainer.parentElement.insertBefore(errorDiv, quizContainer);
    }
}