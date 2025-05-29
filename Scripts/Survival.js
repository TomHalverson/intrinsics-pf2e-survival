// Daily survival system with hunger/thirst tracking, fatigue conditions, and exhaustion escalation
Hooks.on("simple-calendar-day-change", () => {
  dailySurvivalCheck();

  const FOOD_ITEMS = [
    ...["Calico Bass", "Catfish", "Cod", "Common Ling", "Common Pandora", "Crab", "Darmouth Bass", "Geelbeck Croaker", "Herring",
      "Lake Trout", "Leerfish", "Longbill Spearfish", "Midnight Crappie", "Mutton Snapper", "Ochre Fish", "Orchid Bream", "Pike",
      "Pink Salmon", "Rockfish", "Samson Fish", "Scallop", "Scorpionfish", "Shrimp", "Skipjack Tuna", "Vermillion Snapper", "Weakfish", "Tuna Fish", "Mackerel"
    ],
    ...["Agave", "Almond", "Apple", "Apricot", "Artichoke", "Asparagus", "Avocado", "Banana", "Beans", "Beet", "Blueberry", "Brined Cheese", "Broccoli", "Butter", "Button Mushroom",
      "Cabbage", "Cantaloupe", "Carambola", "Carrot", "Cauliflour", "Cayenne Pepper", "Celery", "Cherry", "Chicken Egg", "Chili Pepper", "Chocolate Navel Orange", "Cobnut",
      "Cocoa Beans", "Corn", "Cucumber", "Currants", "Date Fruit", "Dragon Fruit", "Durian", "Eggplants", "Fig", "Grapefruit", "Grapes", "Green Apple", "Green Grapes", "Green Olive", "Green Pepper", "Hazelnut",
      "Kiwifruit", "Leek", "Lemon", "Lemongrass", "Lentils", "Lettuce", "Lime", "Mandarin", "Mango", "Milk", "Olives", "Onion", "Opuntia", "Orange", "Papaya", "Peach", "Peach Figs", "Peanut", "Pear", "Peas", "Pineapple",
      "Pistachio", "Plum", "Pomegranite", "Portobello Mushroom", "Potato", "Pumpkin", "Quince", "Radish", "Raspberry", "Red Cabbage", "Red Onion", "Rhubarb", "Runner Peanut", "Rutabaga", "Scallions", "Shallot", "Sour Cherry",
      "Spinach", "Squash", "Strawberry", "Sugar Beet", "Sugar Pumpkin", "Sugarcane", "Sweetsop", "Tomato", "Truffle", "Turnip", "Walnut", "Watermelon", "White Radish", "Yam", "Zucchini"
    ],
    ...["Bean Soup", "Bread", "Burger", "Cake", "Cheese", "Chocolate", "Dumplings", "Eggs and Sausage", "Fish Soup", "Fruit Jam",
      "Grilled Steak", "Honey Cookies", "Mashed Potatoes", "Mystery Soup", "Pancakes", "Pickled Olives", "Pumpkin Stew", "Quark Balls", "Ramen",
      "Rhubarb Pie", "Salmon Steak", "Sandwich", "Sausages", "Sushi", "Sweet Bread", "Vegetable Soup", "Wall Meat", "Watcher Cake", "Whole Poultry"
    ],
    ...["Rations", "Dried Meat", "Hardtack", "Honey", "Smoked Meats"]
  ];

  const DRINK_ITEMS = ["Ale", "Beer", "Coffee", "Mead", "Moonshine", "Mulled Wine", "Red Revenant's Refresher", "Tea", "Whiterose Chardonnay", "Wine"];
  const MAX_HUNGER = 3;
  const MAX_THIRST = 2;

  async function dailySurvivalCheck() {
    for (const actor of game.actors.contents) {
      if (!actor.hasPlayerOwner || actor.type !== "character") continue;

      const items = actor.items.contents;
      let ateToday = false;
      let drankToday = false;

      for (const item of items) {
        if (!ateToday && FOOD_ITEMS.includes(item.name) && item.system.quantity > 0) {
          await item.update({ "system.quantity": item.system.quantity - 1 });
          ateToday = true;
          ChatMessage.create({ content: `${actor.name} eats ${item.name}` });
        }
        if (!drankToday && DRINK_ITEMS.includes(item.name) && item.system.quantity > 0) {
          await item.update({ "system.quantity": item.system.quantity - 1 });
          drankToday = true;
          ChatMessage.create({ content: `${actor.name} drinks ${item.name}` });
        }
        if (ateToday && drankToday) break;
      }

      let hunger = actor.getFlag("world", "hunger") ?? 0;
      let thirst = actor.getFlag("world", "thirst") ?? 0;

      if (ateToday) {
        hunger = 0;
        await actor.unsetFlag("world", "hunger");
      } else {
        hunger += 1;
        await actor.setFlag("world", "hunger", hunger);
        ChatMessage.create({ content: `${actor.name} did not eat today! (Hunger: ${hunger})` });
      }

      if (drankToday) {
        thirst = 0;
        await actor.unsetFlag("world", "thirst");
      } else {
        thirst += 1;
        await actor.setFlag("world", "thirst", thirst);
        ChatMessage.create({ content: `${actor.name} did not drink today! (Thirst: ${thirst})` });
      }

      if (hunger >= MAX_HUNGER) {
        await applyFatigue(actor, "Hunger");
      }
      if (thirst >= MAX_THIRST) {
        await applyFatigue(actor, "Thirst");
      }

      if (hunger < MAX_HUNGER && thirst < MAX_THIRST) {
        await removeFatigue(actor);
      }

      // Escalation to Exhausted
      if (hunger >= MAX_HUNGER + 2 || thirst >= MAX_THIRST + 2) {
        await applyExhaustion(actor);
      }
    }
  }

  async function applyFatigue(actor, cause) {
    const condition = actor.items.find(i => i.name === `Fatigued (${cause})` && i.type === "condition");
    if (!condition) {
      await game.pf2e.ConditionManager.addConditionToActor(actor, "fatigued");
      ChatMessage.create({ content: `${actor.name} is now Fatigued from ${cause}.` });
    }
  }

  async function removeFatigue(actor) {
    for (const condition of actor.items.filter(i => i.name.startsWith("Fatigued") && i.type === "condition")) {
      await condition.delete();
      ChatMessage.create({ content: `${actor.name}'s fatigue from deprivation has been removed.` });
    }
  }

  async function applyExhaustion(actor) {
    const exhausted = actor.items.find(i => i.name === "Exhausted" && i.type === "condition");
    if (!exhausted) {
      await game.pf2e.ConditionManager.addConditionToActor(actor, "exhausted");
      ChatMessage.create({ content: `${actor.name} is now Exhausted due to prolonged deprivation.` });
    }
  }

});
