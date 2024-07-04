const cards = document.querySelectorAll('.card');

let matchedCard = 0;
let cardOne, cardTwo;
let disableDeck = false;

function flipCard(e) {
	// getting user clicked card
	let clickedCard = e.target;
	if (clickedCard !== cardOne && !disableDeck) {
		clickedCard.classList.add('flip');
		if (!cardOne) {
			// return the cardone value to clickedCard
			return (cardOne = clickedCard);
		}

		cardTwo = clickedCard;
		disableDeck = true;

		let cardOneImg = cardOne.querySelector('img').src,
			cardTwoImg = cardTwo.querySelector('img').src;
		matchCards(cardOneImg, cardTwoImg);
	}
}

function matchCards(img1, img2) {
	if (img1 === img2) {
		// increment matched value by 1
		matchedCard++;
		if (matchedCard == 8) {
			// calling shuffleCard function after 1 sec
			setTimeout(() => {
				shuffleCard();
			}, 1000);
		}
		cardOne.removeEventListener('click', flipCard);
		cardTwo.removeEventListener('click', flipCard);

		// setting both card value to blank
		cardOne = cardTwo = '';
		return (disableDeck = false);
	}

	// if two card not matched
	setTimeout(() => {
		// adding shake class to both card after 400ms
		cardOne.classList.add('shake');
		cardTwo.classList.add('shake');
	}, 400);

	setTimeout(() => {
		// removing both shake & flip classes from the both card after 1.2 seconds
		cardOne.classList.remove('shake', 'flip');
		cardTwo.classList.remove('shake', 'flip');
		// setting both card value to blank
		cardOne = cardTwo = '';
		disableDeck = false;
	}, 1200);
}

function shuffleCard() {
	matchedCard = 0;
	cardOne = cardTwo = '';
	disableDeck = false;

	// creating array of 16 items and each item is repeated twice
	let arr = [ 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8 ];
	arr.sort(() => (Math.random() > 0.5 ? 1 : -1));

	// removing flip class from all cards and passing random image to each card
	cards.forEach((card, i) => {
		card.classList.remove('flip');
		let imgTag = card.querySelector('.back-view img');
		imgTag.src = `img/img-${arr[i]}.png`;
		// Add Eventlistener to all cards
		card.addEventListener('click', flipCard);
	});
}

shuffleCard();

cards.forEach((card) => {
	// card.classList.add('flip');
	// Add Eventlistener to all cards
	card.addEventListener('click', flipCard);
});
