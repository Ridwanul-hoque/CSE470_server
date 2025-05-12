const express = require('express');
const app = express()
require('dotenv').config()
const jwt = require('jsonwebtoken')
const cors = require('cors')
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8gt7g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const usersCollection = client.db("SwiftMartDB").collection("users")
        const businessCollection = client.db("SwiftMartDB").collection("business")
        const inventoryCollection = client.db("SwiftMartDB").collection("inventory")
        const oldCollection = client.db("SwiftMartDB").collection("old")
        const reviewCollection = client.db("SwiftMartDB").collection("reviews")
        const cartCollection = client.db("SwiftMartDB").collection("cart")
        const promoteCollection = client.db("SwiftMartDB").collection("promote")
        const reportCollection = client.db("SwiftMartDB").collection("report")
        const wishlistCollection = client.db("SwiftMartDB").collection("wish")
        const orderHistoryCollection = client.db("SwiftMartDB").collection("history")


        // jwt
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            });
            res.send({ token })

        })

        // middlewares
        const verifyToken = ((req, res, next) => {
            console.log('inside verify headers', req.headers);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'forbidden access' })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
                if (error) {
                    return res.status(401).send({ message: 'forbidden access' })

                }
                req.decoded = decoded
                next()
            })
        })
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }
        // users

        app.get('/users', async (req, res) => {
            console.log(req.headers)
            const result = await usersCollection.find().toArray();
            res.send(result)
        });


        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';

            }
            res.send({ admin })

        })
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query);
            res.send(result)
        })
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            try {
                const query = { email: email };
                const user = await usersCollection.findOne(query);
                if (!user) {
                    return res.status(404).send({ message: 'User not found' });
                }
                res.send(user);
            } catch (error) {
                console.error('Error fetching user data:', error);
                res.status(500).send({ message: 'Internal server error' });
            }
        });

        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const updatedUserData = req.body;

            try {
                const filter = { email: email };
                const options = { upsert: false };
                const { email: _, ...updateData } = updatedUserData;

                const updateDoc = {
                    $set: updateData
                };

                const result = await usersCollection.updateOne(filter, updateDoc, options);

                if (result.matchedCount === 0) {
                    return res.status(404).send({ message: 'User not found' });
                }

                res.send({ success: true, message: 'User updated successfully', result });
            } catch (error) {
                console.error('Error updating user data:', error);
                res.status(500).send({ message: 'Internal server error' });
            }
        });




        // business
        app.post('/business', async (req, res) => {
            const businessData = req.body;

            try {
                const result = await businessCollection.insertOne(businessData);
                res.send({ success: true, insertedId: result.insertedId });
            } catch (error) {
                console.error('Error inserting business data:', error);
                res.status(500).send({ success: false, message: 'Internal Server Error' });
            }
        });

        app.get('/business', async (req, res) => {
            const result = await businessCollection.find().toArray();
            res.send(result);
        });
        app.patch('/business/approve/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const update = { $set: { status: "business" } };
            const result = await businessCollection.updateOne(filter, update);
            res.send(result);
        });
        app.delete('/business/:id', async (req, res) => {
            const id = req.params.id;
            const result = await businessCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        app.put('/business/:email', async (req, res) => {
            const email = req.params.email;
            const updatedData = req.body;

            // Remove _id if it's present in the update payload
            delete updatedData._id;

            const filter = { email: email };
            const updateDoc = {
                $set: updatedData
            };

            try {
                const result = await businessCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                console.error('Error updating business profile:', error);
                res.status(500).send({ message: 'Internal server error' });
            }
        });

        //   Inventory
        app.post('/inventory', async (req, res) => {
            const product = req.body;
            try {
                const result = await inventoryCollection.insertOne(product);
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: 'Error adding product' });
            }
        });
        app.get("/inventory", async (req, res) => {
            const email = req.query.email;
            try {
                const query = email ? { email } : {};
                const items = await inventoryCollection.find(query).toArray();
                res.send(items);
            } catch (err) {
                res.status(500).send({ error: "Failed to fetch items." });
            }
        });

        app.patch('/inventory/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { quantity } = req.body;
                const result = await inventoryCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { quantity } }
                );
                res.send(result);
            } catch (error) {
                console.error("Error updating inventory quantity:", error);
                res.status(500).send({ error: "Failed to update inventory quantity" });
            }
        });

        // app.get('/inventory', async (req, res) => {
        //     const email = req.query.email;
        //     const result = await inventoryCollection.find({ email }).toArray();
        //     res.send(result);
        // });
        app.delete('/inventory/:id', async (req, res) => {
            const id = req.params.id;
            const result = await inventoryCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        const { ObjectId } = require('mongodb');

        app.put('/inventory/:id', async (req, res) => {
            const { id } = req.params;
            const updatedItem = req.body;

            // Remove _id if it exists in the request body
            if (updatedItem._id) {
                delete updatedItem._id;
            }

            try {
                const result = await inventoryCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedItem }
                );

                if (result.modifiedCount > 0) {
                    res.send({ success: true, message: 'Inventory item updated' });
                } else {
                    res.status(404).send({ success: false, message: 'Item not found or no changes made' });
                }
            } catch (error) {
                console.error('Error updating inventory item:', error);
                res.status(500).send({ success: false, message: 'Internal server error' });
            }
        });






        // Reviews
        app.get('/reviews', async (req, res) => {
            try {
                const reviews = await reviewCollection.find().toArray();
                res.send(reviews);
            } catch (error) {
                console.error('Error fetching reviews:', error);
                res.status(500).send({ message: 'Failed to fetch reviews' });
            }
        });

        app.post('/reviews', async (req, res) => {
            try {
                console.log("Received request body:", req.body); // Debugging log

                const { user, comment, rating } = req.body;

                if (!user || !comment || rating === undefined) {
                    return res.status(400).json({ message: 'Missing required fields' });
                }

                // Ensure `rating` is stored as a number
                const newReview = { user, comment, rating: Number(rating), timestamp: new Date() };

                const result = await reviewCollection.insertOne(newReview);
                res.status(201).json({ message: 'Review added successfully', review: newReview });
            } catch (error) {
                console.error('Error adding review:', error);
                res.status(500).json({ message: 'Server error', error: error.message });
            }
        });




        // olditem
        app.post('/old', async (req, res) => {
            try {
                const item = req.body;
                const result = await oldCollection.insertOne(item);
                res.send({ insertedId: result.insertedId });
            } catch (err) {
                res.status(500).send({ error: 'Failed to save item.' });
            }
        });


        app.get('/old', async (req, res) => {
            try {
                const items = await oldCollection.find().toArray();
                res.send(items);
            } catch (err) {
                res.status(500).send({ error: 'Failed to fetch items.' });
            }
        });




        app.put('/old/:id', async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;

            try {
                const result = await oldCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            productName: updatedData.productName,
                            description: updatedData.description,
                            address: updatedData.address,
                            phone: updatedData.phone,
                            useremail: updatedData.useremail, // optional
                            price: updatedData.price,
                            image: updatedData.image,
                            tag: updatedData.tag || 'used' // default if missing
                        }
                    }
                );
                res.send(result);
            } catch (err) {
                console.error('Update failed:', err);
                res.status(500).send({ error: 'Failed to update item.' });
            }
        });

        // app.delete('/old/:id', async (req, res) => {
        //     const id = req.params.id;
        //     try {
        //         const result = await oldCollection.deleteOne({ _id: new ObjectId(id) });
        //         if (result.deletedCount === 1) {
        //             res.send({ success: true });
        //         } else {
        //             res.status(404).send({ error: 'Item not found.' });
        //         }
        //     } catch (err) {
        //         res.status(500).send({ error: 'Failed to delete item.' });
        //     }
        // });

        // DELETE route
        app.delete('/old/:id', async (req, res) => {
            const id = req.params.id;
            const result = await oldCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        // PUT route
        app.put('/old/:id', async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;
            const result = await oldCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updatedData }
            );
            res.send(result);
        });





        // cart
        // app.post("/cart", async (req, res) => {
        //     try {
        //         const item = req.body;

        //         // Optional: Check for duplicates before inserting (especially for 'used' items)
        //         const exists = await cartCollection.findOne({ _id: item._id });
        //         if (exists && item.tag === "used") {
        //             return res.status(409).send({ message: "Item already in cart" });
        //         }

        //         // 🔒 Check inventory for 'business' products to ensure it's in stock
        //         if (item.tag === "business") {
        //             const inventoryItem = await inventoryCollection.findOne({ _id: new ObjectId(item._id) });

        //             if (!inventoryItem || inventoryItem.quantity <= 0) {
        //                 return res.status(400).send({ message: "This product is out of stock." });
        //             }

        //             // Decrease inventory quantity by 1
        //             await inventoryCollection.updateOne(
        //                 { _id: inventoryItem._id },
        //                 { $inc: { quantity: -1 } }
        //             );
        //         }

        //         const result = await cartCollection.insertOne(item);
        //         res.status(201).send(result);
        //     } catch (error) {
        //         console.error("Error adding to cart:", error);
        //         res.status(500).send({ error: "Internal server error" });
        //     }
        // });


        // app.get("/cart", async (req, res) => {
        //     try {
        //         const items = await cartCollection.find().toArray();
        //         res.send(items);
        //     } catch (error) {
        //         console.error("Error fetching cart items:", error);
        //         res.status(500).send({ error: "Internal server error" });
        //     }
        // });
        // app.post("/cart", async (req, res) => {
        //     try {
        //         const item = req.body;

        //         // For 'used' items, only allow once
        //         if (item.tag === "used") {
        //             const exists = await cartCollection.findOne({ _id: item._id });
        //             if (exists) {
        //                 return res.status(409).send({ message: "Used item already in cart" });
        //             }
        //             const result = await cartCollection.insertOne({ ...item, quantity: 1 });
        //             return res.status(201).send(result);
        //         }

        //         // For 'business' items:
        //         if (item.tag === "business") {
        //             const inventoryItem = await inventoryCollection.findOne({ _id: new ObjectId(item._id) });

        //             if (!inventoryItem || inventoryItem.quantity <= 0) {
        //                 return res.status(400).send({ message: "Product out of stock" });
        //             }

        //             const cartItem = await cartCollection.findOne({ _id: item._id });

        //             if (cartItem) {
        //                 // Increment cart quantity by 1
        //                 await cartCollection.updateOne(
        //                     { _id: item._id },
        //                     { $inc: { quantity: 1 } }
        //                 );
        //             } else {
        //                 // Insert new item with quantity 1
        //                 await cartCollection.insertOne({ ...item, quantity: 1 });
        //             }

        //             // Decrement inventory by 1
        //             await inventoryCollection.updateOne(
        //                 { _id: new ObjectId(item._id) },
        //                 { $inc: { quantity: -1 } }
        //             );

        //             return res.status(201).send({ message: "Item added to cart" });
        //         }

        //         return res.status(400).send({ message: "Invalid item tag" });
        //     } catch (error) {
        //         console.error("Error adding to cart:", error);
        //         res.status(500).send({ error: "Internal server error" });
        //     }
        // });





        // // app.delete("/cart/:id", async (req, res) => {
        // //     try {
        // //         const id = req.params.id;
        // //         const result = await cartCollection.deleteOne({ _id: id });
        // //         res.send(result);
        // //     } catch (error) {
        // //         console.error("Error removing from cart:", error);
        // //         res.status(500).send({ error: "Internal server error" });
        // //     }
        // // });
        // app.delete("/cart/:id", async (req, res) => {
        //     try {
        //         const id = req.params.id;

        //         const cartItem = await cartCollection.findOne({ _id: id });

        //         if (!cartItem) {
        //             return res.status(404).send({ error: "Cart item not found" });
        //         }

        //         const inventoryItem = await inventoryCollection.findOne({ productName: cartItem.productName });

        //         if (inventoryItem) {
        //             const restoredQuantity = (inventoryItem.quantity || 0) + (cartItem.quantity || 1);

        //             await inventoryCollection.updateOne(
        //                 { _id: inventoryItem._id },
        //                 { $set: { quantity: restoredQuantity } }
        //             );
        //         }

        //         const result = await cartCollection.deleteOne({ _id: id });

        //         res.send({ success: true, message: "Cart item removed and inventory restored", result });
        //     } catch (error) {
        //         console.error("Error removing from cart:", error);
        //         res.status(500).send({ error: "Internal server error" });
        //     }
        // });


        // // app.patch("/cart/:id", async (req, res) => {
        // //     const { id } = req.params;
        // //     const { quantity } = req.body;

        // //     try {
        // //         const result = await cartCollection.updateOne(
        // //             { _id: new ObjectId(id) },
        // //             { $set: { quantity } }
        // //         );
        // //         res.send(result);
        // //     } catch (err) {
        // //         console.error("Failed to update cart quantity:", err);
        // //         res.status(500).send({ error: "Failed to update cart quantity" });
        // //     }
        // // });
        // // app.patch("/cart/:id", async (req, res) => {
        // //     const { id } = req.params;
        // //     const { quantity } = req.body;

        // //     try {
        // //         const result = await cartCollection.updateOne(
        // //             { _id: new ObjectId(id) },
        // //             { $set: { quantity } }
        // //         );
        // //         res.send(result);
        // //     } catch (err) {
        // //         res.status(500).send({ error: "Failed to update cart quantity" });
        // //     }
        // // });
        // app.patch("/cart/:id", async (req, res) => {
        //     const { id } = req.params;
        //     const { quantity } = req.body; // quantity here means how much to increment by (e.g., +1)

        //     try {
        //         const result = await cartCollection.updateOne(
        //             { _id: new ObjectId(id) },
        //             { $inc: { quantity } }
        //         );
        //         res.send(result);
        //     } catch (err) {
        //         res.status(500).send({ error: "Failed to update cart quantity" });
        //     }
        // });

        // // GET all cart items
        // app.get("/cart", async (req, res) => {
        //     try {
        //         const items = await cartCollection.find().toArray();
        //         res.send(items);
        //     } catch (error) {
        //         res.status(500).send({ error: "Internal server error" });
        //     }
        // });

        // // POST add to cart
        // app.post("/cart", async (req, res) => {
        //     try {
        //         const item = req.body;
        //         const itemId = new ObjectId(item._id);

        //         if (item.tag === "used") {
        //             const exists = await cartCollection.findOne({ _id: itemId });
        //             if (exists) return res.status(409).send({ message: "Used item already in cart" });

        //             await cartCollection.insertOne({ ...item, _id: itemId, quantity: 1 });
        //             return res.status(201).send({ message: "Used item added to cart" });
        //         }

        //         if (item.tag === "business") {
        //             const inventoryItem = await inventoryCollection.findOne({ _id: itemId });
        //             if (!inventoryItem || inventoryItem.quantity <= 0) {
        //                 return res.status(400).send({ message: "Out of stock" });
        //             }

        //             const cartItem = await cartCollection.findOne({ _id: itemId });

        //             if (cartItem) {
        //                 await cartCollection.updateOne(
        //                     { _id: itemId },
        //                     { $inc: { quantity: 1 } }
        //                 );
        //             } else {
        //                 await cartCollection.insertOne({ ...item, _id: itemId, quantity: 1 });
        //             }

        //             await inventoryCollection.updateOne(
        //                 { _id: itemId },
        //                 { $inc: { quantity: -1 } }
        //             );

        //             return res.status(201).send({ message: "Business item added to cart" });
        //         }

        //         return res.status(400).send({ message: "Invalid tag" });
        //     } catch (error) {
        //         res.status(500).send({ error: "Internal server error" });
        //     }
        // });

        // // DELETE from cart
        // app.delete("/cart/:id", async (req, res) => {
        //     try {
        //         const id = new ObjectId(req.params.id);
        //         const cartItem = await cartCollection.findOne({ _id: id });

        //         if (!cartItem) return res.status(404).send({ error: "Cart item not found" });

        //         if (cartItem.tag === "business") {
        //             await inventoryCollection.updateOne(
        //                 { _id: id },
        //                 { $inc: { quantity: cartItem.quantity || 1 } }
        //             );
        //         }

        //         await cartCollection.deleteOne({ _id: id });
        //         res.send({ message: "Item removed from cart and inventory restored" });
        //     } catch (error) {
        //         res.status(500).send({ error: "Internal server error" });
        //     }
        // });



        // GET all cart items
        // a// GET all cart items
        app.get("/cart", async (req, res) => {
            try {
                const userEmail = req.query.userEmail;
                if (!userEmail) {
                    return res.status(400).send({ error: "User email is required" });
                }
                const items = await cartCollection.find({ userEmail: userEmail }).toArray();
                res.send(items);
            } catch (error) {
                res.status(500).send({ error: "Internal server error" });
            }
        });

        // POST add to cart
        app.post("/cart", async (req, res) => {
            try {
                const item = req.body;
                const userEmail = item.userEmail;

                if (!userEmail) {
                    return res.status(400).send({ error: "User email is required" });
                }

                const productId = item._id; // Store original product ID
                delete item._id; // Remove _id to let MongoDB generate a new one

                if (item.tag === "used") {
                    // Check if the item already exists in the user's cart
                    const exists = await cartCollection.findOne({
                        productId: productId,
                        userEmail: userEmail
                    });

                    if (exists) {
                        return res.status(409).send({ message: "Used item already in cart" });
                    }

                    await cartCollection.insertOne({
                        ...item,
                        productId: productId, // Store original product ID as reference
                        quantity: 1
                    });
                    return res.status(201).send({ message: "Used item added to cart" });
                }

                if (item.tag === "business") {
                    const inventoryItem = await inventoryCollection.findOne({
                        _id: new ObjectId(productId)
                    });

                    if (!inventoryItem || inventoryItem.quantity <= 0) {
                        return res.status(400).send({ message: "Out of stock" });
                    }

                    // Check if the item exists in the user's cart
                    const cartItem = await cartCollection.findOne({
                        productId: productId,
                        userEmail: userEmail
                    });

                    if (cartItem) {
                        await cartCollection.updateOne(
                            {
                                productId: productId,
                                userEmail: userEmail
                            },
                            { $inc: { quantity: 1 } }
                        );
                    } else {
                        await cartCollection.insertOne({
                            ...item,
                            productId: productId, // Store original product ID as reference
                            quantity: 1
                        });
                    }

                    await inventoryCollection.updateOne(
                        { _id: new ObjectId(productId) },
                        { $inc: { quantity: -1 } }
                    );

                    return res.status(201).send({ message: "Business item added to cart" });
                }

                return res.status(400).send({ message: "Invalid tag" });
            } catch (error) {
                console.error("Error adding to cart:", error);
                res.status(500).send({ error: "Internal server error" });
            }
        });

        // DELETE from cart
        app.delete("/cart/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const userEmail = req.query.userEmail;

                if (!userEmail) {
                    return res.status(400).send({ error: "User email is required" });
                }

                const cartItem = await cartCollection.findOne({
                    _id: new ObjectId(id),
                    userEmail: userEmail
                });

                if (!cartItem) {
                    return res.status(404).send({ error: "Cart item not found" });
                }

                if (cartItem.tag === "business") {
                    await inventoryCollection.updateOne(
                        { _id: new ObjectId(cartItem.productId) },
                        { $inc: { quantity: cartItem.quantity || 1 } }
                    );
                }

                await cartCollection.deleteOne({
                    _id: new ObjectId(id),
                    userEmail: userEmail
                });

                res.send({ message: "Item removed from cart and inventory restored" });
            } catch (error) {
                console.error("Error removing from cart:", error);
                res.status(500).send({ error: "Internal server error" });
            }
        });








        // Promote 
        // app.post('/promote', async (req, res) => {
        //     const product = req.body;
        //     if (!product || !product._id || !product.email) {
        //         return res.status(400).send({ message: 'Invalid product data' });
        //     }

        //     try {
        //         // Check if already promoted
        //         const exists = await promoteCollection.findOne({ _id: product._id });
        //         if (exists) {
        //             return res.status(409).send({ message: 'Already promoted' });
        //         }

        //         // Create a shallow copy excluding _id
        //         const { _id, ...promoteData } = product;

        //         // Use original _id as a unique key in the promote collection
        //         promoteData._id = _id;

        //         await promoteCollection.insertOne(promoteData);
        //         res.send({ message: 'Product promoted' });
        //     } catch (err) {
        //         console.error('Promote error:', err);
        //         res.status(500).send({ message: 'Server error' });
        //     }
        // });

        app.post('/promote', async (req, res) => {
            const product = req.body;
            if (!product || !product._id || !product.email) {
                return res.status(400).send({ message: 'Invalid product data' });
            }

            try {
                // Check if already promoted by checking existence with original product id stored in a separate field
                const exists = await promoteCollection.findOne({ originalProductId: product._id });
                if (exists) {
                    return res.status(409).send({ message: 'Already promoted' });
                }

                // Create a shallow copy and exclude _id
                const { _id, ...promoteData } = product;

                // Store original product _id in a separate field
                promoteData.originalProductId = _id;

                // MongoDB will now assign a new ObjectId automatically
                await promoteCollection.insertOne(promoteData);
                res.send({ message: 'Product promoted' });
            } catch (err) {
                console.error('Promote error:', err);
                res.status(500).send({ message: 'Server error' });
            }
        });


        // app.delete('/promote/:id', async (req, res) => {
        //     const id = req.params.id;
        //     try {
        //         const result = await promoteCollection.deleteOne({ _id: id });
        //         if (result.deletedCount === 0) {
        //             return res.status(404).send({ message: 'Not found in promote list' });
        //         }
        //         res.send({ message: 'Product unpromoted' });
        //     } catch (err) {
        //         console.error('Unpromote error:', err);
        //         res.status(500).send({ message: 'Server error' });
        //     }
        // });

        app.delete('/promote/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const result = await promoteCollection.deleteOne({ originalProductId: id });
                if (result.deletedCount === 0) {
                    return res.status(404).send({ message: 'Not found in promote list' });
                }
                res.send({ message: 'Product unpromoted' });
            } catch (err) {
                console.error('Unpromote error:', err);
                res.status(500).send({ message: 'Server error' });
            }
        });


        app.get('/promote', async (req, res) => {
            const email = req.query.email;

            try {
                let query = {};
                if (email) {
                    query.email = email;
                }

                const promoted = await promoteCollection.find(query).toArray();
                res.send(promoted);
            } catch (err) {
                console.error('Get promote error:', err);
                res.status(500).send({ message: 'Server error' });
            }
        });






        // report
        app.post('/report', async (req, res) => {
            const report = req.body;
            try {
                const result = await reportCollection.insertOne(report);
                res.status(200).send(result);
            } catch (error) {
                console.error('Failed to insert report:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.get('/reports', async (req, res) => {
            try {
                const email = req.query.email;
                const query = email ? { email } : {};
                const reports = await reportCollection.find(query).toArray();
                res.send(reports);
            } catch (error) {
                console.error('Error fetching reports:', error);
                res.status(500).send({ error: 'Failed to fetch reports' });
            }
        });


        app.patch('/report/:id', async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;

            const result = await reportCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status } }
            );

            res.send(result);
        });










        // payment
        
        app.post('/create-payment-intent', async (req, res) => {
            try {
                const { amount, userEmail } = req.body;

                const paymentIntent = await stripe.paymentIntents.create({
                    amount,
                    currency: 'usd',
                    metadata: { userEmail },
                    automatic_payment_methods: {
                        enabled: true,
                    },
                });

                res.send({
                    clientSecret: paymentIntent.client_secret,
                });
            } catch (error) {
                console.error('Error creating payment intent:', error);
                res.status(500).send({ error: error.message });
            }
        });

        app.post('/history', async (req, res) => {
            try {
                const orderData = req.body;
                const result = await orderHistoryCollection.insertOne(orderData);
                res.send(result);
            } catch (error) {
                console.error('Error saving order history:', error);
                res.status(500).send({ error: error.message });
            }
        });

        app.get('/history', async (req, res) => {
            try {
                const userEmail = req.query.userEmail;
                const query = { userEmail };
                const result = await orderHistoryCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                console.error('Error fetching order history:', error);
                res.status(500).send({ error: error.message });
            }
        });


























        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();/
    }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('Online')
})

app.listen(port, () => {
    console.log(`Online market is ready ${port}`);

})