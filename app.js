const { useState, useEffect, useRef, useCallback } = React;

const CARD_VALUES = [1, 2, 3, 4, 5, 6, 7, 8];

    value,
    image: `img/img-${value}.png`,
    isFlipped: false,
    isMatched: false,
    isShaking: false,
  }));
};

main
const MemoryGame = () => {
  const [cards, setCards] = useState(() => createShuffledCards());
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
 main

  const clearScheduledActions = useCallback(() => {
    timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutsRef.current = [];
 main
  }, []);

  const resetGame = useCallback(() => {
    clearScheduledActions();
    setCards(createShuffledCards());
    setFlippedIndices([]);
    setIsProcessing(false);
 main
  }, [clearScheduledActions]);

  useEffect(() => {
    return () => {
      clearScheduledActions();
    };
  }, [clearScheduledActions]);

 main
      )
    );

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length !== 2) {
      return;
    }

    setIsProcessing(true);
 main
          }
          return item;
        });

 main
      });

      setFlippedIndices([]);
      setIsProcessing(false);
      return;
    }

    scheduleTimeout(() => {
 main
          if (card.isFlipped) {
            cardClasses.push("flip");
          }
          if (card.isShaking) {
            cardClasses.push("shake");
          }
 main
            </li>
          );
        })}
      </ul>
main
  );
};

const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);
root.render(<MemoryGame />);
