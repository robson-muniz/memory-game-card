const { useState, useEffect, useRef, useCallback } = React;

const CARD_VALUES = [1, 2, 3, 4, 5, 6, 7, 8];

const createShuffledCards = () => {
  const values = [...CARD_VALUES, ...CARD_VALUES];
  values.sort(() => (Math.random() > 0.5 ? 1 : -1));

  return values.map((value, index) => ({
    id: `${value}-${index}-${Math.random().toString(36).slice(2, 9)}`,
    value,
    image: `img/img-${value}.png`,
    isFlipped: false,
    isMatched: false,
    isShaking: false,
  }));
};

const MemoryGame = () => {
  const [cards, setCards] = useState(() => createShuffledCards());
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const timeoutsRef = useRef([]);

  const clearScheduledActions = useCallback(() => {
    timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutsRef.current = [];
  }, []);

  const resetGame = useCallback(() => {
    clearScheduledActions();
    setCards(createShuffledCards());
    setFlippedIndices([]);
    setIsProcessing(false);
  }, [clearScheduledActions]);

  useEffect(() => {
    return () => {
      clearScheduledActions();
    };
  }, [clearScheduledActions]);

  const scheduleTimeout = (callback, delay) => {
    const timeoutId = setTimeout(() => {
      callback();
      timeoutsRef.current = timeoutsRef.current.filter((id) => id !== timeoutId);
    }, delay);

    timeoutsRef.current.push(timeoutId);
  };

  const handleCardClick = (index) => {
    if (isProcessing) return;

    const card = cards[index];
    if (card.isFlipped || card.isMatched) return;

    setCards((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, isFlipped: true } : item
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
    const secondCard = cards[index];

    if (firstCard.value === secondCard.value) {
      setCards((prev) => {
        const updated = prev.map((item, itemIndex) => {
          if (itemIndex === firstIndex || itemIndex === secondIndex) {
            return { ...item, isMatched: true, isFlipped: true };
          }
          return item;
        });

        const allMatched = updated.every((item) => item.isMatched);
        if (allMatched) {
          scheduleTimeout(resetGame, 1000);
        }

        return updated;
      });

      setFlippedIndices([]);
      setIsProcessing(false);
      return;
    }

    scheduleTimeout(() => {
      setCards((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === firstIndex || itemIndex === secondIndex
            ? { ...item, isShaking: true }
            : item
        )
      );
    }, 400);

    scheduleTimeout(() => {
      setCards((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === firstIndex || itemIndex === secondIndex
            ? { ...item, isFlipped: false, isShaking: false }
            : item
        )
      );
      setFlippedIndices([]);
      setIsProcessing(false);
    }, 1200);
  };

  return (
    <div className="wrapper">
      <ul className="cards">
        {cards.map((card, index) => {
          const cardClasses = ["card"];
          if (card.isFlipped) {
            cardClasses.push("flip");
          }
          if (card.isShaking) {
            cardClasses.push("shake");
          }

          return (
            <li
              key={card.id}
              className={cardClasses.join(" ")}
              onClick={() => handleCardClick(index)}
            >
              <div className="view front-view">
                <span className="material-icons">question_mark</span>
              </div>
              <div className="view back-view">
                <img src={card.image} alt="" />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);
root.render(<MemoryGame />);
