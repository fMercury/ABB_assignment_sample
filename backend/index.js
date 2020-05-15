'use strict';
const { createServer } = require('http');
const bodyParser = require('body-parser');
const express = require('express');

const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');
const { makeExecutableSchema } = require('graphql-tools');
const { execute, subscribe } = require('graphql');

const { SubscriptionServer } = require('subscriptions-transport-ws');
const { PubSub } = require('graphql-subscriptions');

const pubsub = new PubSub();

//list to record new piece
const partProducedList = []
let lastPartProduced = null

// types definition
const typeDefs = ` 
  input ControlInfo {
    name: String!
    dev: Int!
    devOutTotal: Int!
    expected: Int!
  }
  input FeatureInfo {
    name: String!
    controls: [ControlInfo!]!
  }
  input PartInfo {
    name: String!
    features: [FeatureInfo!]!
  }
  type Control {
    name: String!
    dev: Int!
    devOutTotal: Int!
    expected: Int!
  }
  type Feature {
    name: String!
    controls: [Control!]!
  }
  type Part {
    name: String!
    features: [Feature!]!
  }
  type Query {
    partQuery: Part
  } 
  type Mutation {
    pushPart(newPart: PartInfo!): Part
  }

  
`;

// resolvers definition
const resolvers = {
    //resolver for query
    Query: {
        partQuery: () => lastPartProduced,
    },
    //resolver for mutation 
    Mutation: {
        pushPart: (root, args) => {
            const new_part_produced = {
                name: args.newPart.name,
                features: args.newPart.features.map(feature => {
                    return {
                        name: feature.name,
                        controls: feature.controls.map(control => {
                            return {
                                name: control.name,
                                dev: control.dev,
                                devOutTotal: control.devOutTotal,
                                expected: control.expected
                            }
                        })
                    }
                })
            };
            //record piece/part
            partProducedList.push(new_part_produced);
            lastPartProduced = new_part_produced;
            return new_part_produced;
        },
    },
};

// schema definition
const schema = makeExecutableSchema({ typeDefs, resolvers });

const app = express();

// middlewares
app.use('/graphql', bodyParser.json(), graphqlExpress({ schema }));
app.use('/graphiql', graphiqlExpress({
    endpointURL: '/graphql',
    subscriptionsEndpoint: `ws://localhost:4000/subscriptions`
}));

const ws = createServer(app);

// template for subscriptions
ws.listen(4000, () => {
    console.log('Graphic Interface http://localhost:4000/graphiql');

    new SubscriptionServer({
        execute,
        subscribe,
        schema
    }, {
        server: ws,
        path: '/subscriptions',
    });

});


