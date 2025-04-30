const express = require('express');
const app = express()
require('dotenv').config()
const jwt = require('jsonwebtoken')
const cors = require('cors')
const port = process.env.PORT || 5000;

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
        app.get('/inventory', async (req, res) => {
            const email = req.query.email;
            const result = await inventoryCollection.find({ email }).toArray();
            res.send(result);
        });
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