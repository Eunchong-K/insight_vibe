class FlashcardApp {
    constructor() {
        this.words = [];
        this.currentWords = [];
        this.currentIndex = 0;
        this.score = 0;
        this.userAnswers = [];
        this.hasAnswered = false;
        this.autoProgressTimer = null;
        
        this.initializeElements();
        this.bindEvents();
        this.loadWords();
    }

    initializeElements() {
        // 스크린 요소
        this.screens = {
            start: document.getElementById('startScreen'),
            study: document.getElementById('studyScreen'),
            result: document.getElementById('resultScreen'),
            history: document.getElementById('historyScreen')
        };

        // 버튼 요소
        this.buttons = {
            start: document.getElementById('startBtn'),
            startNew: document.getElementById('startNewBtn'),
            scoreHistory: document.getElementById('scoreHistoryBtn'),
            next: document.getElementById('nextBtn'),
            review: document.getElementById('reviewBtn'),
            newSession: document.getElementById('newSessionBtn'),
            closeHistory: document.getElementById('closeHistoryBtn')
        };

        // 학습 관련 요소
        this.studyElements = {
            currentWord: document.getElementById('currentWord'),
            totalWords: document.getElementById('totalWords'),
            progressFill: document.getElementById('progressFill'),
            wordText: document.getElementById('wordText'),
            wordType: document.getElementById('wordType'),
            wordMeaning: document.getElementById('wordMeaning'),
            quizSection: document.getElementById('quizSection'),
            quizOptions: document.getElementById('quizOptions')
        };

        // 결과 관련 요소
        this.resultElements = {
            icon: document.getElementById('resultIcon'),
            title: document.getElementById('resultTitle'),
            scoreText: document.getElementById('scoreText')
        };

        // 기록 관련 요소
        this.historyElements = {
            list: document.getElementById('historyList')
        };
    }

    bindEvents() {
        this.buttons.start.addEventListener('click', () => this.startNewSession());
        this.buttons.startNew.addEventListener('click', () => this.startNewSession());
        this.buttons.scoreHistory.addEventListener('click', () => this.showHistory());
        this.buttons.next.addEventListener('click', () => this.nextWord());
        this.buttons.review.addEventListener('click', () => this.reviewSession());
        this.buttons.newSession.addEventListener('click', () => this.startNewSession());
        this.buttons.closeHistory.addEventListener('click', () => this.hideHistory());
    }

    async loadWords() {
        try {
            console.log('단어 데이터 로드 중...');
            const response = await fetch('data/words.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.words = await response.json();
            console.log('단어 데이터 로드 완료:', this.words.length, '개 단어');
            
            // DOM 로드 확인 후 UI 업데이트
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.updateUI();
                });
            } else {
                this.updateUI();
            }
        } catch (error) {
            console.error('단어 데이터 로드 실패:', error);
            this.showError('단어 데이터를 불러오는데 실패했습니다. 파일 경로를 확인해주세요.');
        }
    }

    updateUI() {
        // UI가 준비되었음을 표시
        if (this.words.length > 0) {
            console.log('UI 업데이트 완료');
        }
    }

    startNewSession() {
        if (this.words.length < 10) {
            this.showError('학습할 단어가 충분하지 않습니다. 최소 10개 단어가 필요합니다.');
            return;
        }

        console.log('새 학습 세션 시작');
        
        // 랜덤으로 10개 단어 선택 (겹치지 않도록)
        this.currentWords = this.shuffleArray([...this.words]).slice(0, 10);
        this.currentIndex = 0;
        this.score = 0;
        this.userAnswers = [];
        this.hasAnswered = false;

        this.showScreen('study');
        this.updateProgress();
        this.displayCurrentWord();
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    displayCurrentWord() {
        const currentWord = this.currentWords[this.currentIndex];
        
        console.log('현재 단어:', currentWord);
        
        // 단어와 의미를 처음부터 모두 표시 (플래시카드 앞면에)
        this.studyElements.wordText.textContent = currentWord.word;
        this.studyElements.wordType.textContent = currentWord.type;
        
        // 의미를 카드 앞면에도 표시 (처음부터 보이게)
        const meaningElement = document.createElement('div');
        meaningElement.className = 'word-meaning';
        meaningElement.textContent = currentWord.meaning;
        meaningElement.style.marginTop = '20px';
        meaningElement.style.fontSize = '1.6rem';
        meaningElement.style.color = '#4b5563';
        meaningElement.style.textAlign = 'center';
        meaningElement.style.lineHeight = '1.6';
        meaningElement.style.fontWeight = '500';
        
        // 기존 의미 요소가 있다면 제거하고 새로 추가
        const existingMeaning = document.querySelector('.card-front .word-meaning');
        if (existingMeaning) {
            existingMeaning.remove();
        }
        document.querySelector('.card-front').appendChild(meaningElement);
        
        // 퀴즈 옵션 생성 (다른 단어의 의미 포함)
        this.generateQuizOptions(currentWord);
        
        // 버튼 상태 초기화
        this.buttons.next.disabled = true;
        this.hasAnswered = false;
        
        // 퀴즈 섹션 표시
        this.studyElements.quizSection.style.display = 'block';
        
        // 화면을 상단으로 스크롤
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
    }

    generateQuizOptions(currentWord) {
        this.studyElements.quizOptions.innerHTML = '';
        
        // 현재 단어의 정답 포함하여 4개 옵션 만들기
        const options = [currentWord.meaning];
        
        // 다른 단어에서 잘못된 답 가져오기 (랜덤하게 3개 선택)
        const otherWords = this.words.filter(word => word.word !== currentWord.word);
        const shuffledOtherWords = this.shuffleArray([...otherWords]);
        
        // 3개의 잘못된 답 추가 (중복되지 않게)
        let addedCount = 0;
        for (let i = 0; i < shuffledOtherWords.length && addedCount < 3; i++) {
            // 이미 추가된 의미와 중복되지 않는지 확인
            if (!options.includes(shuffledOtherWords[i].meaning)) {
                options.push(shuffledOtherWords[i].meaning);
                addedCount++;
            }
        }
        
        // 만약 충분한 다른 의미가 없다면 기본값 추가
        while (options.length < 4) {
            const defaultOptions = ['매우 작은', '거의 없는', '아주 드문', '특별한'];
            const randomDefault = defaultOptions[Math.floor(Math.random() * defaultOptions.length)];
            if (!options.includes(randomDefault)) {
                options.push(randomDefault);
            }
        }
        
        // 옵션들을 섞기
        const shuffledOptions = this.shuffleArray(options);
        
        shuffledOptions.forEach((option, index) => {
            const optionElement = document.createElement('button');
            optionElement.className = 'quiz-option';
            optionElement.textContent = option;
            optionElement.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectAnswer(option, currentWord.meaning);
            });
            this.studyElements.quizOptions.appendChild(optionElement);
        });
    }

    selectAnswer(selectedOption, correctAnswer) {
        if (this.hasAnswered) return;
        
        console.log('답변 선택:', selectedOption, '정답:', correctAnswer);
        
        this.hasAnswered = true;
        const options = this.studyElements.quizOptions.querySelectorAll('.quiz-option');
        
        options.forEach(option => {
            option.disabled = true;
            if (option.textContent === correctAnswer) {
                option.classList.add('correct');
            } else if (option.textContent === selectedOption && selectedOption !== correctAnswer) {
                option.classList.add('incorrect');
            }
        });

        const isCorrect = selectedOption === correctAnswer;
        if (isCorrect) {
            this.score++;
            console.log('정답! 현재 점수:', this.score);
        }

        this.userAnswers.push({
            word: this.currentWords[this.currentIndex].word,
            selectedAnswer: selectedOption,
            correctAnswer: correctAnswer,
            isCorrect: isCorrect
        });

        // 다음 버튼 활성화
        this.buttons.next.disabled = false;
        this.buttons.next.textContent = '다음 단어로';
        this.buttons.next.innerHTML = '<i class="fas fa-arrow-right"></i> 다음 단어로';

        // 3초 후 자동으로 다음 단어로 진행
        this.autoProgressTimer = setTimeout(() => {
            this.nextWord();
        }, 3000);

        // 화면을 하단으로 스크롤하여 다음 버튼이 보이도록 함
        setTimeout(() => {
            const controlsElement = document.querySelector('.study-controls');
            if (controlsElement) {
                controlsElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 500);
    }

    nextWord() {
        // 자동 진행 타이머 정리
        if (this.autoProgressTimer) {
            clearTimeout(this.autoProgressTimer);
            this.autoProgressTimer = null;
        }

        this.currentIndex++;
        
        if (this.currentIndex >= this.currentWords.length) {
            this.showResult();
        } else {
            this.updateProgress();
            this.displayCurrentWord();
        }
    }

    updateProgress() {
        const progress = ((this.currentIndex) / this.currentWords.length) * 100;
        if (this.studyElements.progressFill) {
            this.studyElements.progressFill.style.width = `${progress}%`;
        }
        if (this.studyElements.currentWord) {
            this.studyElements.currentWord.textContent = this.currentIndex + 1;
        }
        if (this.studyElements.totalWords) {
            this.studyElements.totalWords.textContent = this.currentWords.length;
        }
    }

    showResult() {
        this.saveScore();
        this.showScreen('result');
        
        const percentage = (this.score / this.currentWords.length) * 100;
        
        if (this.resultElements.scoreText) {
            this.resultElements.scoreText.textContent = this.score;
        }
        
        if (percentage >= 80) {
            this.resultElements.icon.className = 'result-icon fas fa-trophy success';
            this.resultElements.title.textContent = '훌륭합니다!';
        } else if (percentage >= 60) {
            this.resultElements.icon.className = 'result-icon fas fa-thumbs-up improvement';
            this.resultElements.title.textContent = '잘 하셨습니다!';
        } else {
            this.resultElements.icon.className = 'result-icon fas fa-heart improvement';
            this.resultElements.title.textContent = '더 노력해봅시다!';
        }
        
        console.log('학습 완료! 점수:', this.score, '/', this.currentWords.length);
    }

    saveScore() {
        try {
            const scores = JSON.parse(localStorage.getItem('flashcardScores') || '[]');
            const newScore = {
                date: new Date().toLocaleDateString('ko-KR'),
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                score: this.score,
                total: this.currentWords.length,
                timestamp: Date.now()
            };
            
            scores.push(newScore);
            // 최근 50개 기록만 유지
            if (scores.length > 50) {
                scores.shift();
            }
            
            localStorage.setItem('flashcardScores', JSON.stringify(scores));
            console.log('점수 저장 완료');
        } catch (error) {
            console.error('점수 저장 실패:', error);
        }
    }

    showHistory() {
        this.loadHistory();
        this.showScreen('history');
    }

    hideHistory() {
        this.showScreen('start');
    }

    loadHistory() {
        try {
            const scores = JSON.parse(localStorage.getItem('flashcardScores') || '[]');
            
            if (scores.length === 0) {
                this.historyElements.list.innerHTML = '<div class="no-history">아직 학습 기록이 없습니다.</div>';
                return;
            }

            // 최신순으로 정렬
            scores.sort((a, b) => b.timestamp - a.timestamp);

            this.historyElements.list.innerHTML = '';
            scores.forEach(score => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.innerHTML = `
                    <div>
                        <div class="history-date">${score.date} ${score.time}</div>
                    </div>
                    <div class="history-score">${score.score}/${score.total}</div>
                `;
                this.historyElements.list.appendChild(historyItem);
            });
        } catch (error) {
            console.error('기록 로드 실패:', error);
            this.historyElements.list.innerHTML = '<div class="no-history">기록을 불러오는데 실패했습니다.</div>';
        }
    }

    reviewSession() {
        // 현재 세션 다시 보기
        this.currentIndex = 0;
        this.score = 0;
        this.userAnswers = [];
        this.hasAnswered = false;

        this.showScreen('study');
        this.updateProgress();
        this.displayCurrentWord();
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            if (screen) {
                screen.classList.remove('active');
            }
        });
        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
        }
        console.log('화면 전환:', screenName);
    }

    showError(message) {
        console.error('오류:', message);
        alert(message);
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 로드 완료, 앱 초기화 시작');
    const app = new FlashcardApp();
    console.log('앱 초기화 완료');
});