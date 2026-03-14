'use strict';

class FlashcardApp {
    constructor() {
        // ── 데이터 상태 ──────────────────────────────
        this.words        = [];          // 전체 단어 원본
        this.filteredWords = [];         // 필터 적용 단어
        this.currentWords  = [];         // 현재 세션 단어
        this.currentIndex  = 0;
        this.score         = 0;
        this.wrongWords    = [];         // 틀린 단어 목록
        this.userAnswers   = [];
        this.hasAnswered   = false;
        this.isWrongReview = false;      // 틀린 단어 재학습 모드

        // ── 필터 상태 ─────────────────────────────────
        this.selectedLevel    = 'all';
        this.selectedCategory = 'all';
        this.wordCount        = 10;

        // ── 타이머 ───────────────────────────────────
        this.autoProgressTimer  = null;
        this.countdownInterval  = null;
        this.countdownRemaining = 3;

        // ── Web Audio ────────────────────────────────
        this.audioCtx = null;

        this._initElements();
        this._bindEvents();
        this._loadWords();
    }

    // ════════════════════════════════════════════════
    //  초기화
    // ════════════════════════════════════════════════
    _initElements() {
        this.el = {
            // 스크린
            startScreen:   document.getElementById('startScreen'),
            studyScreen:   document.getElementById('studyScreen'),
            resultScreen:  document.getElementById('resultScreen'),
            historyScreen: document.getElementById('historyScreen'),

            // 설정 UI
            wordCountSlider:  document.getElementById('wordCountSlider'),
            wordCountDisplay: document.getElementById('wordCountDisplay'),
            availableCount:   document.getElementById('availableCount'),
            categoryGrid:     document.getElementById('categoryGrid'),

            // 학습 화면
            currentWord:   document.getElementById('currentWord'),
            totalWords:    document.getElementById('totalWords'),
            progressFill:  document.getElementById('progressFill'),
            liveScore:     document.getElementById('liveScore'),
            wordText:      document.getElementById('wordText'),
            wordType:      document.getElementById('wordType'),
            wordLevel:     document.getElementById('wordLevel'),
            quizOptions:   document.getElementById('quizOptions'),
            nextBtn:       document.getElementById('nextBtn'),

            // 카운트다운
            countdownArea: document.getElementById('countdownArea'),
            countdownNum:  document.getElementById('countdownNum'),
            ringProgress:  document.getElementById('ringProgress'),

            // 결과 화면
            resultIcon:      document.getElementById('resultIcon'),
            resultTitle:     document.getElementById('resultTitle'),
            scoreText:       document.getElementById('scoreText'),
            scoreTotalNum:   document.getElementById('scoreTotalNum'),
            resultMessage:   document.getElementById('resultMessage'),
            reviewWrongBtn:  document.getElementById('reviewWrongBtn'),

            // 기록 화면
            historyList:     document.getElementById('historyList'),

            // 푸터
            footerWordCount: document.getElementById('footerWordCount'),
        };
    }

    _bindEvents() {
        // 헤더 버튼
        document.getElementById('startNewBtn')
            .addEventListener('click', () => this._goToStart());
        document.getElementById('scoreHistoryBtn')
            .addEventListener('click', () => this._showHistory());

        // 시작 화면 – 레벨
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedLevel = btn.dataset.level;
                this._applyFilter();
            });
        });

        // 시작 화면 – 전체 카테고리 버튼
        document.querySelector('.cat-btn[data-cat="all"]')
            .addEventListener('click', (e) => {
                document.querySelectorAll('.cat-btn, .cat-letter-btn')
                    .forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.selectedCategory = 'all';
                this._applyFilter();
            });

        // 단어 수 슬라이더
        this.el.wordCountSlider.addEventListener('input', () => {
            this.wordCount = parseInt(this.el.wordCountSlider.value);
            this.el.wordCountDisplay.textContent = this.wordCount;
            this._applyFilter();
        });

        // 시작 버튼
        document.getElementById('startBtn')
            .addEventListener('click', () => this._startSession(this.filteredWords));

        // 학습 화면
        this.el.nextBtn.addEventListener('click', () => this._nextWord());

        // 결과 화면
        this.el.reviewWrongBtn.addEventListener('click', () => this._startWrongReview());
        document.getElementById('reviewBtn')
            .addEventListener('click', () => this._reviewSession());
        document.getElementById('newSessionBtn')
            .addEventListener('click', () => this._goToStart());

        // 기록 화면
        document.getElementById('closeHistoryBtn')
            .addEventListener('click', () => this._closeHistory());
        document.getElementById('clearHistoryBtn')
            .addEventListener('click', () => this._clearHistory());
    }

    // ════════════════════════════════════════════════
    //  데이터 로드
    // ════════════════════════════════════════════════
    async _loadWords() {
        try {
            const res = await fetch('data/words.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            this.words = await res.json();

            this._buildCategoryButtons();
            this._applyFilter();
            if (this.el.footerWordCount)
                this.el.footerWordCount.textContent = this.words.length;
        } catch (err) {
            console.error('단어 로드 실패:', err);
            alert('단어 데이터를 불러오는 데 실패했습니다.\ndata/words.json 경로를 확인해주세요.');
        }
    }

    _buildCategoryButtons() {
        const cats = [...new Set(this.words.map(w => w.category))].sort();
        const grid = this.el.categoryGrid;
        grid.innerHTML = '';
        cats.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'cat-letter-btn';
            btn.dataset.cat = cat;
            btn.textContent = cat;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cat-btn, .cat-letter-btn')
                    .forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedCategory = cat;
                this._applyFilter();
            });
            grid.appendChild(btn);
        });
    }

    _applyFilter() {
        let pool = [...this.words];
        if (this.selectedLevel !== 'all')
            pool = pool.filter(w => w.level === this.selectedLevel);
        if (this.selectedCategory !== 'all')
            pool = pool.filter(w => w.category === this.selectedCategory);

        this.filteredWords = pool;
        if (this.el.availableCount)
            this.el.availableCount.textContent = pool.length;

        // 슬라이더 max 업데이트
        const maxCount = Math.min(pool.length, 50);
        this.el.wordCountSlider.max = maxCount || 50;
        if (this.wordCount > maxCount && maxCount > 0) {
            this.wordCount = maxCount;
            this.el.wordCountSlider.value = maxCount;
            this.el.wordCountDisplay.textContent = maxCount;
        }
    }

    // ════════════════════════════════════════════════
    //  화면 전환
    // ════════════════════════════════════════════════
    _showScreen(name) {
        ['startScreen','studyScreen','resultScreen','historyScreen'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
        const target = document.getElementById(name);
        if (target) target.classList.add('active');
    }

    _goToStart() {
        this._clearTimers();
        this._showScreen('startScreen');
    }

    // ════════════════════════════════════════════════
    //  세션 시작
    // ════════════════════════════════════════════════
    _startSession(pool) {
        if (pool.length < 4) {
            alert('선택한 조건에 해당하는 단어가 너무 적습니다.\n(최소 4개 필요)\n다른 조건을 선택해주세요.');
            return;
        }
        const count = Math.min(this.wordCount, pool.length);
        this.currentWords  = this._shuffle([...pool]).slice(0, count);
        this.currentIndex  = 0;
        this.score         = 0;
        this.wrongWords    = [];
        this.userAnswers   = [];
        this.hasAnswered   = false;

        this._showScreen('studyScreen');
        this._updateProgress();
        this._displayWord();
    }

    _startWrongReview() {
        if (!this.wrongWords.length) return;
        this.isWrongReview = true;
        this._startSession(this.wrongWords);
        this.isWrongReview = false;
    }

    _reviewSession() {
        this._startSession(this.currentWords);
    }

    // ════════════════════════════════════════════════
    //  단어 표시
    // ════════════════════════════════════════════════
    _displayWord() {
        this._clearTimers();

        const w = this.currentWords[this.currentIndex];

        // 카드: 단어 + 품사 + 레벨만 표시 (뜻 숨김)
        this.el.wordText.textContent = w.word;
        this.el.wordType.textContent = w.type;
        this.el.wordLevel.textContent = w.level;
        this.el.wordLevel.className =
            'word-level-badge level-' + this._levelClass(w.level);

        // 퀴즈 생성
        this._generateQuiz(w);

        // 버튼 초기화
        this.el.nextBtn.disabled = true;
        this.el.nextBtn.innerHTML = '<i class="fas fa-arrow-right"></i> 다음 단어';
        this.hasAnswered = false;

        // 카운트다운 숨김
        this.el.countdownArea.classList.add('hidden');
    }

    _levelClass(level) {
        const map = { '초급': 'easy', '중급': 'medium', '고급': 'hard' };
        return map[level] || 'easy';
    }

    // ════════════════════════════════════════════════
    //  퀴즈 옵션 생성
    // ════════════════════════════════════════════════
    _generateQuiz(currentWord) {
        const container = this.el.quizOptions;
        container.innerHTML = '';

        // 정답 포함 4개 옵션 구성
        const options = [currentWord.meaning];
        const others  = this._shuffle(
            this.words.filter(w => w.word !== currentWord.word)
        );

        for (const w of others) {
            if (options.length >= 4) break;
            if (!options.includes(w.meaning)) options.push(w.meaning);
        }

        // 혹시 부족하면 기본값 채우기
        const fallbacks = ['매우 작은','거의 없는','아주 드문','특별한','일반적인','평범한'];
        let fi = 0;
        while (options.length < 4) {
            if (!options.includes(fallbacks[fi])) options.push(fallbacks[fi]);
            fi++;
        }

        this._shuffle(options).forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option';
            btn.textContent = opt;
            btn.addEventListener('click', () =>
                this._selectAnswer(opt, currentWord.meaning)
            );
            container.appendChild(btn);
        });
    }

    // ════════════════════════════════════════════════
    //  답 선택
    // ════════════════════════════════════════════════
    _selectAnswer(selected, correct) {
        if (this.hasAnswered) return;
        this.hasAnswered = true;

        const isCorrect = selected === correct;
        const buttons   = this.el.quizOptions.querySelectorAll('.quiz-option');

        buttons.forEach(btn => {
            btn.disabled = true;
            if (btn.textContent === correct)     btn.classList.add('correct');
            else if (btn.textContent === selected) btn.classList.add('incorrect');
        });

        if (isCorrect) {
            this.score++;
            this._playCorrectSound();
            this._launchSparkles();
        } else {
            this._playWrongSound();
            // 틀린 단어 저장 (중복 방지)
            const w = this.currentWords[this.currentIndex];
            if (!this.wrongWords.find(x => x.word === w.word))
                this.wrongWords.push(w);
        }

        this.el.liveScore.textContent = this.score;

        this.userAnswers.push({
            word:      this.currentWords[this.currentIndex].word,
            selected,
            correct,
            isCorrect
        });

        // 다음 버튼 활성화
        this.el.nextBtn.disabled = false;

        // 3초 카운트다운 자동 진행
        this._startCountdown();
    }

    // ════════════════════════════════════════════════
    //  카운트다운
    // ════════════════════════════════════════════════
    _startCountdown() {
        this.countdownRemaining = 3;
        this.el.countdownArea.classList.remove('hidden');
        this.el.countdownNum.textContent = this.countdownRemaining;
        this._updateRing(this.countdownRemaining, 3);

        this.countdownInterval = setInterval(() => {
            this.countdownRemaining--;
            this.el.countdownNum.textContent = this.countdownRemaining;
            this._updateRing(this.countdownRemaining, 3);

            if (this.countdownRemaining <= 0) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                this._nextWord();
            }
        }, 1000);
    }

    _updateRing(remaining, total) {
        const circle = this.el.ringProgress;
        if (!circle) return;
        const r          = 18;
        const circumf    = 2 * Math.PI * r;
        const fraction   = remaining / total;
        circle.style.strokeDasharray  = `${circumf}`;
        circle.style.strokeDashoffset = `${circumf * (1 - fraction)}`;
    }

    // ════════════════════════════════════════════════
    //  다음 단어 / 결과
    // ════════════════════════════════════════════════
    _nextWord() {
        this._clearTimers();
        this.el.countdownArea.classList.add('hidden');
        this.currentIndex++;

        if (this.currentIndex >= this.currentWords.length) {
            this._showResult();
        } else {
            this._updateProgress();
            this._displayWord();
        }
    }

    _updateProgress() {
        const pct = (this.currentIndex / this.currentWords.length) * 100;
        this.el.progressFill.style.width    = `${pct}%`;
        this.el.currentWord.textContent     = this.currentIndex + 1;
        this.el.totalWords.textContent      = this.currentWords.length;
        this.el.liveScore.textContent       = this.score;
    }

    // ════════════════════════════════════════════════
    //  결과 화면
    // ════════════════════════════════════════════════
    _showResult() {
        this._saveScore();
        this._showScreen('resultScreen');

        const total = this.currentWords.length;
        const pct   = (this.score / total) * 100;

        this.el.scoreText.textContent    = this.score;
        this.el.scoreTotalNum.textContent = total;

        if (pct === 100) {
            this.el.resultIcon.className = 'result-icon fas fa-trophy success';
            this.el.resultTitle.textContent = '완벽합니다! 🎉';
            this.el.resultMessage.textContent = '모든 단어를 맞히셨어요!';
        } else if (pct >= 80) {
            this.el.resultIcon.className = 'result-icon fas fa-star success';
            this.el.resultTitle.textContent = '훌륭합니다!';
            this.el.resultMessage.textContent = '거의 다 맞혔어요. 조금만 더 노력하면 완벽!';
        } else if (pct >= 60) {
            this.el.resultIcon.className = 'result-icon fas fa-thumbs-up improvement';
            this.el.resultTitle.textContent = '잘 하셨습니다!';
            this.el.resultMessage.textContent = '꾸준히 학습하면 금방 향상될 거예요!';
        } else {
            this.el.resultIcon.className = 'result-icon fas fa-heart improvement';
            this.el.resultTitle.textContent = '더 노력해봅시다!';
            this.el.resultMessage.textContent = '틀린 단어를 다시 학습해보세요.';
        }

        // 틀린 단어 재학습 버튼
        if (this.wrongWords.length > 0) {
            this.el.reviewWrongBtn.style.display = 'inline-flex';
            this.el.reviewWrongBtn.innerHTML =
                `<i class="fas fa-exclamation-circle"></i> 틀린 단어 재학습 (${this.wrongWords.length}개)`;
        } else {
            this.el.reviewWrongBtn.style.display = 'none';
        }
    }

    // ════════════════════════════════════════════════
    //  점수 저장
    // ════════════════════════════════════════════════
    _saveScore() {
        try {
            const scores = JSON.parse(localStorage.getItem('flashcardScores') || '[]');
            scores.push({
                date:      new Date().toLocaleDateString('ko-KR'),
                time:      new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                score:     this.score,
                total:     this.currentWords.length,
                level:     this.selectedLevel,
                category:  this.selectedCategory,
                timestamp: Date.now()
            });
            if (scores.length > 50) scores.shift();
            localStorage.setItem('flashcardScores', JSON.stringify(scores));
        } catch (e) {
            console.warn('점수 저장 실패:', e);
        }
    }

    // ════════════════════════════════════════════════
    //  학습 기록
    // ════════════════════════════════════════════════
    _showHistory() {
        this._renderHistory();
        this._showScreen('historyScreen');
    }

    _closeHistory() {
        this._showScreen('startScreen');
    }

    _renderHistory() {
        try {
            const scores = JSON.parse(localStorage.getItem('flashcardScores') || '[]');

            if (!scores.length) {
                this.el.historyList.innerHTML =
                    '<div class="no-history"><i class="fas fa-inbox"></i><p>아직 학습 기록이 없습니다.</p></div>';
                return;
            }

            scores.sort((a, b) => b.timestamp - a.timestamp);
            this.el.historyList.innerHTML = '';

            scores.forEach(s => {
                const pct  = Math.round((s.score / s.total) * 100);
                const cls  = pct >= 80 ? 'grade-high' : pct >= 60 ? 'grade-mid' : 'grade-low';
                const cat  = s.category && s.category !== 'all' ? `[${s.category}]` : '';
                const lv   = s.level   && s.level   !== 'all' ? s.level : '전체';
                const item = document.createElement('div');
                item.className = 'history-item';
                item.innerHTML = `
                    <div class="history-info">
                        <div class="history-date">${s.date} ${s.time}</div>
                        <div class="history-meta">${lv} ${cat}</div>
                    </div>
                    <div class="history-score ${cls}">${s.score}/${s.total}
                        <span class="history-pct">${pct}%</span>
                    </div>`;
                this.el.historyList.appendChild(item);
            });
        } catch (e) {
            this.el.historyList.innerHTML =
                '<div class="no-history">기록을 불러오는 데 실패했습니다.</div>';
        }
    }

    _clearHistory() {
        if (!confirm('모든 학습 기록을 삭제할까요?')) return;
        localStorage.removeItem('flashcardScores');
        this._renderHistory();
    }

    // ════════════════════════════════════════════════
    //  유틸리티
    // ════════════════════════════════════════════════
    _shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    _clearTimers() {
        if (this.autoProgressTimer)  { clearTimeout(this.autoProgressTimer);   this.autoProgressTimer  = null; }
        if (this.countdownInterval)  { clearInterval(this.countdownInterval);   this.countdownInterval  = null; }
    }

    // ════════════════════════════════════════════════
    //  Web Audio – 효과음
    // ════════════════════════════════════════════════
    _getAudioCtx() {
        if (!this.audioCtx) {
            try {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) { return null; }
        }
        return this.audioCtx;
    }

    _playCorrectSound() {
        const ctx = this._getAudioCtx();
        if (!ctx) return;

        // 상승 화음 (C5 → E5 → G5)
        [[523, 0], [659, 0.1], [784, 0.2]].forEach(([freq, delay]) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
            gain.gain.setValueAtTime(0.25, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.4);
        });
    }

    _playWrongSound() {
        const ctx = this._getAudioCtx();
        if (!ctx) return;

        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
    }

    // ════════════════════════════════════════════════
    //  스파클 효과
    // ════════════════════════════════════════════════
    _launchSparkles() {
        const container = document.getElementById('sparkleContainer');
        if (!container) return;

        const colors = ['#f59e0b','#6366f1','#10b981','#ec4899','#f97316','#06b6d4'];
        const shapes = ['✦','★','✸','✿','◆','●'];
        const count  = 28;

        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            el.className = 'sparkle';

            // 화면 중앙 기준 랜덤 위치에서 출발
            const startX = 30 + Math.random() * 40;   // vw %
            const startY = 30 + Math.random() * 40;   // vh %

            const angle  = (Math.random() * 360);
            const dist   = 80 + Math.random() * 180;  // px
            const dx     = Math.cos((angle * Math.PI) / 180) * dist;
            const dy     = Math.sin((angle * Math.PI) / 180) * dist;
            const size   = 12 + Math.random() * 20;
            const dur    = 600 + Math.random() * 700;

            el.textContent = shapes[Math.floor(Math.random() * shapes.length)];
            el.style.cssText = `
                left: ${startX}vw;
                top:  ${startY}vh;
                font-size: ${size}px;
                color: ${colors[Math.floor(Math.random() * colors.length)]};
                --dx: ${dx}px;
                --dy: ${dy}px;
                animation: sparkleFly ${dur}ms ease-out forwards;
            `;
            container.appendChild(el);
            setTimeout(() => el.remove(), dur + 50);
        }
    }
}

// ── 앱 부트 ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    window._app = new FlashcardApp();
});
