import genanki
import random

def create_anki_deck(cards_data, deck_name="FlashDeck", output_filename="flashdeck_generated.apkg"):
    # 1. Generate Unique ID
    deck_id = random.randrange(1 << 30, 1 << 31)
    
    # 2. Create Deck
    my_deck = genanki.Deck(deck_id, f"FlashDeck - {deck_name}")
    
    # 3. Define Model (Card Style)
    my_model = genanki.Model(
        1607392319,
        'Simple Model',
        fields=[
            {'name': 'Question'},
            {'name': 'Answer'},
        ],
        templates=[
            {
                'name': 'Card 1',
                'qfmt': '{{Question}}',
                'afmt': '{{FrontSide}}<hr id="answer">{{Answer}}',
            },
        ])

    # 4. Add Cards
    for card in cards_data:
        note = genanki.Note(
            model=my_model,
            fields=[card['q'], card['a']]
        )
        my_deck.add_note(note)

    # 5. Save
    genanki.Package(my_deck).write_to_file(output_filename)
    
    return output_filename
