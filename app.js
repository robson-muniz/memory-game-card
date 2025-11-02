const { useState, useEffect, useRef, useCallback } = React;

const CARD_VALUES = [1, 2, 3, 4, 5, 6, 7, 8];
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
    image: `img/img-${value}.png`,
    isFlipped: false,
    isMatched: false,
    isShaking: false,
  }));
};

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

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

const MemoryGame = () => {
  const [cards, setCards] = useState(() => createShuffledCards());
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [gameStatus, setGameStatus] = useState("idle");
  const [moves, setMoves] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [bestResult, setBestResult] = useState(() => readBestResult());
  const initialTheme = getInitialTheme();
  const [theme, setTheme] = useState(() => initialTheme);
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
  const [didSetNewRecord, setDidSetNewRecord] = useState(false);

  const timeoutsRef = useRef([]);
  const timerRef = useRef(null);

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

  useEffect(() => {
    return () => {
      clearScheduledActions();
    };
  }, [clearScheduledActions]);

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

  const handleCardClick = (index) => {
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

  const matchedPairs = cards.filter((card) => card.isMatched).length / 2;
  const totalPairs = cards.length / 2;
  const progressPercent = totalPairs
    ? Math.round((matchedPairs / totalPairs) * 100)
    : 0;
  const accuracy = moves === 0 ? null : Math.round((matchedPairs / moves) * 100);
  const statusMessage = (() => {
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
  })();

  const toggleTheme = () => {
    setIsManualTheme(true);
    setTheme((previous) => (previous === "light" ? "dark" : "light"));
  };

  return (
    <main className="app" aria-label="Memory game">
      <header className="app__header">
        <h1 className="app__title">Memory Match</h1>
        <div className="app__actions">
          <button type="button" className="theme-toggle" onClick={toggleTheme}>
            <span className="material-icons" aria-hidden="true">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
            <span className="sr-only">Toggle theme</span>
          </button>
          <button type="button" className="reset-button" onClick={resetGame}>
            <span className="material-icons" aria-hidden="true">
              replay
            </span>
            <span>Restart</span>
          </button>
        </div>
      </header>

      <section className="metrics" aria-label="Game statistics">
        <div className="metric">
          <span className="metric__label">Moves</span>
          <span className="metric__value">{moves}</span>
        </div>
        <div className="metric">
          <span className="metric__label">Time</span>
          <span className="metric__value">{formatTime(secondsElapsed)}</span>
        </div>
        <div className="metric">
          <span className="metric__label">Best</span>
          <span className="metric__value">
            {bestResult
              ? `${bestResult.moves} / ${formatTime(bestResult.seconds)}`
              : "—"}
          </span>
        </div>
        <div className="metric">
          <span className="metric__label">Accuracy</span>
          <span className="metric__value">{accuracy !== null ? `${accuracy}%` : "—"}</span>
        </div>
      </section>

      <p className="status-message" role="status" aria-live="polite">
        {statusMessage}
      </p>

      <div
        className="progress"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={progressPercent}
        aria-valuetext={`${progressPercent}% complete`}
      >
        <div className="progress__bar" style={{ width: `${progressPercent}%` }} />
        <span className="progress__label">{progressPercent}% complete</span>
      </div>

      <ul className="cards" role="list">
        {cards.map((card, index) => {
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
            <li key={card.id} className="card" role="presentation">
              <button
                type="button"
                className={cardClasses.join(" ")}
                onClick={() => handleCardClick(index)}
                aria-label={getCardAriaLabel(card)}
                aria-pressed={card.isFlipped}
                disabled={card.isMatched || card.isFlipped || isProcessing}
              >
                <div className="view front-view">
                  <span className="material-icons" aria-hidden="true">
                    question_mark
                  </span>
                </div>
                <div className="view back-view">
                  <img
                    src={card.image}
                    alt={`Illustration of card ${card.value}`}
                    loading="lazy"
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
};

const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);
root.render(<MemoryGame />);
