import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ----------------------------------------
// Utilities
// ----------------------------------------

// Responsive board dimensions
const getBoardDimensions = () => {
    if (typeof window === 'undefined') {
        return { rows: 4, columns: 4 };
    }

    const width = window.innerWidth;
    if (width < 400) {
        return { rows: 3, columns: 4 }; // 12 cards for very small screens
    } else if (width < 500) {
        return { rows: 4, columns: 4 }; // 16 cards for small screens
    } else {
        return { rows: 4, columns: 4 }; // 16 cards for larger screens
    }
};

const BOARD_DIMENSIONS = Object.freeze(getBoardDimensions());
const TOTAL_CARD_COUNT = BOARD_DIMENSIONS.rows * BOARD_DIMENSIONS.columns;
const CARD_VALUES = Array.from({ length: TOTAL_CARD_COUNT / 2 }, (_, index) => index + 1);
const BEST_RESULT_STORAGE_KEY = "memory-game-best-result";
const THEME_STORAGE_KEY = "memory-game-theme";

const getRandomInt = (max) => {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        const randomBuffer = new Uint32Array(1);
        crypto.getRandomValues(randomBuffer);
        return Math.floor((randomBuffer[0] / (0xffffffff + 1)) * max);
    }

    return Math.floor(Math.random() * max);
};

const shuffleArray = (source) => {
    const array = [...source];

    for (let index = array.length - 1; index > 0; index -= 1) {
        const swapIndex = getRandomInt(index + 1);
        [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
    }

    return array;
};

const createCardId = (value, index) => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `${value}-${index}-${Math.random().toString(36).slice(2, 11)}`;
};

const createShuffledCards = () => {
    const duplicatedValues = [...CARD_VALUES, ...CARD_VALUES];
    const values = shuffleArray(duplicatedValues);

    return values.map((value, index) => ({
        id: createCardId(value, index),
        value,
        image: `./img/img-${value}.png`,
        isFlipped: false,
        isMatched: false,
        isShaking: false,
        imageError: false,
    }));
};

const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// ----------------------------------------
// Storage helpers
// ----------------------------------------

const readBestResult = () => {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const storedValue = window.localStorage.getItem(BEST_RESULT_STORAGE_KEY);
        return storedValue ? JSON.parse(storedValue) : null;
    } catch (error) {
        return null;
    }
};

const storeBestResult = (result) => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.localStorage.setItem(BEST_RESULT_STORAGE_KEY, JSON.stringify(result));
    } catch (error) {
        // Ignore storage write errors (e.g. private mode).
    }
};

const getInitialTheme = () => {
    if (typeof window === "undefined") {
        return "light";
    }

    try {
        const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme === "light" || storedTheme === "dark") {
            return storedTheme;
        }

        if (
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
        ) {
            return "dark";
        }
    } catch (error) {
        // Ignore read errors and fall back to default theme.
    }

    return "light";
};

const getCardAriaLabel = (card) => {
    if (card.isMatched) {
        return `Matched card showing ${card.value}`;
    }

    if (card.isFlipped) {
        return `Card showing ${card.value}`;
    }

    return "Hidden card";
};

// ----------------------------------------
// Hooks
// ----------------------------------------

const useThemePreference = () => {
    const [theme, setTheme] = useState(() => getInitialTheme());
    const [isManualTheme, setIsManualTheme] = useState(() => {
        if (typeof window === "undefined") {
            return false;
        }

        try {
            return Boolean(window.localStorage.getItem(THEME_STORAGE_KEY));
        } catch (error) {
            return false;
        }
    });

    useEffect(() => {
        if (typeof document === "undefined") {
            return;
        }

        document.documentElement.dataset.theme = theme;

        if (typeof window !== "undefined") {
            try {
                window.localStorage.setItem(THEME_STORAGE_KEY, theme);
            } catch (error) {
                // Ignore storage write errors (e.g. private mode).
            }
        }
    }, [theme]);

    useEffect(() => {
        if (
            typeof window === "undefined" ||
            !window.matchMedia ||
            typeof window.matchMedia !== "function" ||
            isManualTheme
        ) {
            return undefined;
        }

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        const handleChange = (event) => {
            setTheme(event.matches ? "dark" : "light");
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [isManualTheme]);

    const toggleTheme = useCallback(() => {
        setIsManualTheme(true);
        setTheme((previous) => (previous === "light" ? "dark" : "light"));
    }, []);

    return { theme, toggleTheme };
};

const useMemoryGameState = () => {
    const [boardDimensions, setBoardDimensions] = useState(() => getBoardDimensions());
    const [cards, setCards] = useState(() => createShuffledCards());
    const [flippedIndices, setFlippedIndices] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [gameStatus, setGameStatus] = useState("idle");
    const [moves, setMoves] = useState(0);
    const [secondsElapsed, setSecondsElapsed] = useState(0);
    const [bestResult, setBestResult] = useState(() => readBestResult());
    const [didSetNewRecord, setDidSetNewRecord] = useState(false);

    const timeoutsRef = useRef([]);
    const timerRef = useRef(null);

    // Update board dimensions on resize
    useEffect(() => {
        const handleResize = () => {
            setBoardDimensions(getBoardDimensions());
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Recreate cards when board dimensions change
    useEffect(() => {
        resetGame();
    }, [boardDimensions]);

    const clearScheduledActions = useCallback(() => {
        timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
        timeoutsRef.current = [];

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const scheduleTimeout = useCallback((callback, delay) => {
        const timeoutId = setTimeout(() => {
            callback();
            timeoutsRef.current = timeoutsRef.current.filter((id) => id !== timeoutId);
        }, delay);

        timeoutsRef.current.push(timeoutId);
    }, []);

    const resetGame = useCallback(() => {
        clearScheduledActions();
        setCards(createShuffledCards());
        setFlippedIndices([]);
        setIsProcessing(false);
        setGameStatus("idle");
        setMoves(0);
        setSecondsElapsed(0);
        setDidSetNewRecord(false);
    }, [clearScheduledActions]);

    useEffect(() => () => clearScheduledActions(), [clearScheduledActions]);

    useEffect(() => {
        if (gameStatus !== "running") {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return undefined;
        }

        timerRef.current = setInterval(() => {
            setSecondsElapsed((prev) => prev + 1);
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [gameStatus]);

    const updateBestResult = useCallback((candidate) => {
        let didUpdate = false;
        setBestResult((previous) => {
            if (
                !previous ||
                candidate.moves < previous.moves ||
                (candidate.moves === previous.moves && candidate.seconds < previous.seconds)
            ) {
                storeBestResult(candidate);
                didUpdate = true;
                return candidate;
            }

            return previous;
        });
        setDidSetNewRecord(didUpdate);
    }, []);

    const handleCardClick = useCallback(
        (index) => {
            if (isProcessing) {
                return;
            }

            const card = cards[index];
            if (!card || card.isFlipped || card.isMatched) {
                return;
            }

            if (gameStatus === "idle") {
                setGameStatus("running");
            }

            setCards((previousCards) =>
                previousCards.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, isFlipped: true, isShaking: false } : item
                )
            );

            const newFlipped = [...flippedIndices, index];
            setFlippedIndices(newFlipped);

            if (newFlipped.length !== 2) {
                return;
            }

            setIsProcessing(true);

            const [firstIndex, secondIndex] = newFlipped;
            const firstCard = cards[firstIndex];
            const secondCard = cards[secondIndex];

            if (!firstCard || !secondCard) {
                setFlippedIndices([]);
                setIsProcessing(false);
                return;
            }
            const didMatch = firstCard.value === secondCard.value;
            const nextMoveCount = moves + 1;
            setMoves(nextMoveCount);

            if (didMatch) {
                setCards((previousCards) => {
                    const updatedCards = previousCards.map((item, itemIndex) => {
                        if (itemIndex === firstIndex || itemIndex === secondIndex) {
                            return { ...item, isMatched: true, isFlipped: true, isShaking: false };
                        }
                        return item;
                    });

                    const allMatched = updatedCards.every((item) => item.isMatched);
                    if (allMatched) {
                        setGameStatus("complete");
                        updateBestResult({ moves: nextMoveCount, seconds: secondsElapsed });
                    }

                    return updatedCards;
                });

                setFlippedIndices([]);
                setIsProcessing(false);
                return;
            }

            scheduleTimeout(() => {
                setCards((previousCards) =>
                    previousCards.map((item, itemIndex) => {
                        if (itemIndex === firstIndex || itemIndex === secondIndex) {
                            return { ...item, isShaking: true };
                        }
                        return item;
                    })
                );
            }, 350);

            scheduleTimeout(() => {
                setCards((previousCards) =>
                    previousCards.map((item, itemIndex) => {
                        if (itemIndex === firstIndex || itemIndex === secondIndex) {
                            return { ...item, isFlipped: false, isShaking: false };
                        }
                        return item;
                    })
                );
                setFlippedIndices([]);
                setIsProcessing(false);
            }, 1000);
        },
        [
            cards,
            flippedIndices,
            gameStatus,
            isProcessing,
            moves,
            scheduleTimeout,
            secondsElapsed,
            updateBestResult,
        ]
    );

    const matchedPairs = useMemo(
        () => cards.filter((card) => card.isMatched).length / 2,
        [cards]
    );
    const totalPairs = cards.length / 2;
    const progressPercent = totalPairs
        ? Math.round((matchedPairs / totalPairs) * 100)
        : 0;
    const accuracy = useMemo(
        () => (moves === 0 ? null : Math.round((matchedPairs / moves) * 100)),
        [matchedPairs, moves]
    );

    const handleCardImageError = useCallback((index) => {
        setCards((previousCards) =>
            previousCards.map((item, itemIndex) =>
                itemIndex === index ? { ...item, imageError: true } : item
            )
        );
    }, []);

    const statusMessage = useMemo(() => {
        if (gameStatus === "complete") {
            if (didSetNewRecord) {
                return `New personal best! ${moves} moves in ${formatTime(secondsElapsed)}.`;
            }
            return `Great job! Completed in ${moves} moves and ${formatTime(secondsElapsed)}.`;
        }

        if (matchedPairs > 0) {
            return `Nice! ${matchedPairs} of ${totalPairs} pairs found${
                accuracy !== null ? ` • ${accuracy}% accuracy` : ""
            }.`;
        }

        return "Flip cards to find all matching pairs.";
    }, [accuracy, didSetNewRecord, gameStatus, matchedPairs, moves, secondsElapsed, totalPairs]);

    return {
        cards,
        moves,
        secondsElapsed,
        bestResult,
        accuracy,
        progressPercent,
        statusMessage,
        handleCardClick,
        resetGame,
        isProcessing,
        handleCardImageError,
        boardDimensions,
    };
};

// ----------------------------------------
// Presentational components
// ----------------------------------------

const ThemeToggleButton = ({ theme, onToggle }) => (
    <button type="button" className="theme-toggle" onClick={onToggle}>
    <span className="material-icons" aria-hidden="true">
      {theme === "dark" ? "light_mode" : "dark_mode"}
    </span>
        <span className="sr-only">Toggle theme</span>
    </button>
);

const ResetButton = ({ onReset }) => (
    <button type="button" className="reset-button" onClick={onReset}>
        <span className="material-icons" aria-hidden="true">replay</span>
        <span className="reset-text">Restart</span>
    </button>
);

const GameHeader = ({ theme, onToggleTheme, onReset }) => (
    <header className="app__header">
        <h1 className="app__title">Memory Match</h1>
        <div className="app__actions">
            <ThemeToggleButton theme={theme} onToggle={onToggleTheme} />
            <ResetButton onReset={onReset} />
        </div>
    </header>
);

const MetricItem = ({ label, value }) => (
    <div className="metric">
        <span className="metric__label">{label}</span>
        <span className="metric__value">{value}</span>
    </div>
);

const MetricsPanel = ({ moves, secondsElapsed, bestResult, accuracy }) => (
    <section className="metrics" aria-label="Game statistics">
        <MetricItem label="Moves" value={moves} />
        <MetricItem label="Time" value={formatTime(secondsElapsed)} />
        <MetricItem
            label="Best"
            value={
                bestResult ? `${bestResult.moves} / ${formatTime(bestResult.seconds)}` : "—"
            }
        />
        <MetricItem label="Accuracy" value={accuracy !== null ? `${accuracy}%` : "—"} />
    </section>
);

const StatusMessage = ({ message }) => (
    <p className="status-message" role="status" aria-live="polite">
        {message}
    </p>
);

const ProgressBar = ({ percent }) => (
    <div
        className="progress"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={percent}
        aria-valuetext={`${percent}% complete`}
    >
        <div className="progress__bar" style={{ width: `${percent}%` }} />
        <span className="progress__label">{percent}% complete</span>
    </div>
);

const CardButton = ({ card, onClick, disabled, onImageError }) => {
    const cardClasses = ["card-button"];
    if (card.isFlipped) {
        cardClasses.push("flip");
    }
    if (card.isShaking) {
        cardClasses.push("shake");
    }
    if (card.isMatched) {
        cardClasses.push("matched");
    }

    return (
        <button
            type="button"
            className={cardClasses.join(" ")}
            onClick={onClick}
            aria-label={getCardAriaLabel(card)}
            aria-pressed={card.isFlipped}
            disabled={disabled}
        >
            <div className="view front-view">
        <span className="material-icons" aria-hidden="true">
          question_mark
        </span>
            </div>
            <div className="view back-view">
                {!card.imageError && (
                    <img
                        src={card.image}
                        alt={`Illustration of card ${card.value}`}
                        loading="lazy"
                        onError={onImageError}
                    />
                )}
                {card.imageError && (
                    <span className="card-label is-visible" aria-hidden="true">
            {card.value}
          </span>
                )}
            </div>
        </button>
    );
};

const CardGrid = ({
                      cards,
                      onCardClick,
                      isProcessing,
                      onImageError,
                      columns = 4,
                  }) => (
    <ul
        className="cards"
        role="list"
        style={{ "--grid-columns": String(columns) }}
    >
        {cards.map((card, index) => (
            <li key={card.id} className="card" role="presentation">
                <CardButton
                    card={card}
                    onClick={() => onCardClick(index)}
                    disabled={card.isMatched || card.isFlipped || isProcessing}
                    onImageError={() => onImageError(index)}
                />
            </li>
        ))}
    </ul>
);

// ----------------------------------------
// Footer Component
// ----------------------------------------

const AppFooter = () => (
    <footer className="app-footer">
        <div className="footer-content">
            <p className="footer-text">
                &copy; {new Date().getFullYear()} Built by Robson Muniz
            </p>
            <div className="footer-links">
                <a
                    href="mailto:robson@example.com"
                    className="footer-link"
                    aria-label="Send email to Robson Muniz"
                >
                    <span className="material-icons" aria-hidden="true">email</span>
                    <span className="footer-link-text">Email</span>
                </a>
                <a
                    href="https://github.com/robsonmuniz"
                    className="footer-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visit Robson Muniz's GitHub profile"
                >
                    <span className="material-icons" aria-hidden="true">code</span>
                    <span className="footer-link-text">GitHub</span>
                </a>
                <a
                    href="https://linkedin.com/in/robsonmuniz"
                    className="footer-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visit Robson Muniz's LinkedIn profile"
                >
                    <span className="material-icons" aria-hidden="true">work</span>
                    <span className="footer-link-text">LinkedIn</span>
                </a>
            </div>
        </div>
    </footer>
);

const MemoryGame = () => {
    const {
        cards,
        moves,
        secondsElapsed,
        bestResult,
        accuracy,
        progressPercent,
        statusMessage,
        handleCardClick,
        resetGame,
        isProcessing,
        handleCardImageError,
        boardDimensions,
    } = useMemoryGameState();
    const { theme, toggleTheme } = useThemePreference();

    return (
        <div className="app-container">
            <main className="app" aria-label="Memory game">
                <GameHeader theme={theme} onToggleTheme={toggleTheme} onReset={resetGame} />
                <MetricsPanel
                    moves={moves}
                    secondsElapsed={secondsElapsed}
                    bestResult={bestResult}
                    accuracy={accuracy}
                />
                <StatusMessage message={statusMessage} />
                <ProgressBar percent={progressPercent} />
                <CardGrid
                    cards={cards}
                    onCardClick={handleCardClick}
                    isProcessing={isProcessing}
                    onImageError={handleCardImageError}
                    columns={boardDimensions.columns}
                />
            </main>
            <AppFooter />
        </div>
    );
};

export default MemoryGame;