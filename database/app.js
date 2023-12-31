const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Load the SQL schema file
const sqlSchema = fs.readFileSync(path.join(__dirname, 'recipe_manager_schema.sql'), 'utf-8');

// Create a new database instance
const db = new sqlite3.Database('recipe_manager.db', (err) => {
  if (err) {
    console.error(err.message);
    throw err;
  } else {
    console.log('Connected to the SQLite database.');
    // Create tables if they don't exist
    db.exec(sqlSchema, (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log('Tables created or already exist.');
      }
    });
  }
});

// Remember to close the database connection when your app finishes
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('SQLite database connection closed.');
  });
});


function createRecipe(userId, recipeDetails, ingredients) {
  // SQL query to insert a new recipe
  const insertRecipeQuery = 'INSERT INTO recipes (user_id, title, cuisine_type, preparation_time, servings, instructions) VALUES (?, ?, ?, ?, ?, ?)';
  
  // Begin a transaction
  db.serialize(() => {
    db.run(insertRecipeQuery, [userId, recipeDetails.title, recipeDetails.cuisineType, recipeDetails.preparationTime, recipeDetails.servings, recipeDetails.instructions], function(err) {
      if (err) {
        return console.error(err.message);
      }
      console.log('A new recipe has been added with ID: ' + this.lastID);

      // Insert ingredients and associate them with the recipe
      ingredients.forEach(ingredient => {
        const insertIngredientQuery = 'INSERT INTO ingredients (name, quantity, unit) VALUES (?, ?, ?)';
        const insertRecipeIngredientsQuery = 'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, required) VALUES (?, ?, ?, ?, ?)';

        db.run(insertIngredientQuery, [ingredient.name, ingredient.quantity, ingredient.unit], function(err) {
          if (err) {
            return console.error(err.message);
          }
          const ingredientId = this.lastID;
          db.run(insertRecipeIngredientsQuery, [this.lastID, ingredientId, ingredient.quantity, ingredient.unit, ingredient.required], function(err) {
            if (err) {
              return console.error(err.message);
            }
          });
        });
      });
    });
  });
}

function editRecipe(recipeId, recipeDetails, ingredients) {
  // SQL query to update an existing recipe
  const updateRecipeQuery = 'UPDATE recipes SET title = ?, cuisine_type = ?, preparation_time = ?, servings = ?, instructions = ? WHERE id = ?';

  // Begin a transaction
  db.serialize(() => {
    db.run(updateRecipeQuery, [recipeDetails.title, recipeDetails.cuisineType, recipeDetails.preparationTime, recipeDetails.servings, recipeDetails.instructions, recipeId], function(err) {
      if (err) {
        return console.error(err.message);
      }
      console.log('Recipe with ID ' + recipeId + ' has been updated');

      // Update ingredients and their association with the recipe
      ingredients.forEach(ingredient => {
        const updateIngredientQuery = ingredient.id ? 'UPDATE ingredients SET name = ?, quantity = ?, unit = ? WHERE id = ?' : 'INSERT INTO ingredients (name, quantity, unit) VALUES (?, ?, ?)';
        const updateRecipeIngredientsQuery = 'REPLACE INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, required) VALUES (?, ?, ?, ?, ?)';

        db.run(updateIngredientQuery, ingredient.id ? [ingredient.name, ingredient.quantity, ingredient.unit, ingredient.id] : [ingredient.name, ingredient.quantity, ingredient.unit], function(err) {
          if (err) {
            return console.error(err.message);
          }
          const ingredientId = ingredient.id ? ingredient.id : this.lastID;
          db.run(updateRecipeIngredientsQuery, [recipeId, ingredientId, ingredient.quantity, ingredient.unit, ingredient.required], function(err) {
            if (err) {
              return console.error(err.message);
            }
          });
        });
      });
    });
  });
}

function addCategory(name) {
  // SQL query to insert a new category
  const insertCategoryQuery = 'INSERT INTO categories (name) VALUES (?)';

  db.run(insertCategoryQuery, [name], function(err) {
    if (err) {
      return console.error(err.message);
    }
    console.log('A new category has been added with ID: ' + this.lastID);
  });
}

function categorizeRecipe(recipeId, categoryId) {
  // SQL query to update the category of a recipe
  const updateRecipeCategoryQuery = 'UPDATE recipes SET category_id = ? WHERE id = ?';

  db.run(updateRecipeCategoryQuery, [categoryId, recipeId], function(err) {
    if (err) {
      return console.error(err.message);
    }
    console.log('Recipe with ID ' + recipeId + ' has been categorized under category ID: ' + categoryId);
  });
}

function addUser(username, email, dietary, callback) {
  const sql = `INSERT INTO users (username, email, dietary) VALUES (?, ?, ?)`;
  db.run(sql, [username, email, dietary], function(err) {
    if (err) {
      return callback(err);
    }
    return callback(null, { id: this.lastID });
  });
}

// Expose the function for external access
module.exports = {
  addUser
};

function addMealToPlan(date, mealType, recipeId, callback) {
  const sql = `INSERT INTO meal_plans (date, meal_type, recipe_id) VALUES (?, ?, ?)`;
  db.run(sql, [date, mealType, recipeId], function(err) {
      if (err) {
          return callback(err);
      }
      return callback(null, { id: this.lastID });
  });
}

// Expose the function for external access (e.g., via IPC in an Electron app)
module.exports = {
  addMealToPlan
};

function searchRecipesByIngredient(ingredient, callback) {
  const sql = `
      SELECT recipes.*
      FROM recipes
      JOIN recipe_ingredients ON recipes.id = recipe_ingredients.recipe_id
      JOIN ingredients ON recipe_ingredients.ingredient_id = ingredients.id
      WHERE ingredients.name LIKE ?
  `;
  db.all(sql, [`%${ingredient}%`], function(err, rows) {
      if (err) {
          return callback(err);
      }
      return callback(null, rows);
  });
}

// Expose the function for external access
module.exports = {
  searchRecipesByIngredient
};

function searchRecipesByTitle(title, callback) {
  const sql = `
      SELECT *
      FROM recipes
      WHERE title LIKE ?
  `;
  db.all(sql, [`%${title}%`], function(err, rows) {
      if (err) {
          return callback(err);
      }
      return callback(null, rows);
  });
}

// Expose the function for external access
module.exports = {
  searchRecipesByTitle
};