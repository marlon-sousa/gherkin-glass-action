Feature: Basket
  A shopper keeps what they mean to buy in a basket.

  Scenario: Adding an item
    Given an empty basket
    When the shopper adds a book
    Then the basket holds one item
