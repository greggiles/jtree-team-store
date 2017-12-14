var express = require('express');
var router = express.Router();
var Cart = require('../models/cart');

var User = require('../models/user');
var Product = require('../models/product');
var Productcount = require('../models/productcount');
var Order = require('../models/order');

var nodemailer = require('nodemailer');
var mg = require('nodemailer-mailgun-transport');

// This is your API key that you retrieve from www.mailgun.com/cp (free up to 10K monthly emails)
var auth = {
    auth: {
        api_key: process.env.EMAIL_API,
        domain: 'jtreestore.lefernando.xyz'
    }
}

var nodemailerMailgun = nodemailer.createTransport(mg(auth));


/* GET home page. */
router.get('/', function (req, res, next) {
    var successMsg = req.flash('success')[0];
    var query = req.query;
    if (query.sex == "*") delete query.sex;
    if (query.family == "*") delete query.family;
    if (query.size == "*") delete query.size;

    Product.find(query, function (err, docs) {
        var productChunks = [];
        var chunkSize = 3;
        for (var i = 0; i < docs.length; i += chunkSize) {
            productChunks.push(docs.slice(i, i + chunkSize));
        }
        res.render('shop/index', {
            title: 'JTree Kit',
            products: productChunks,
            query: req.query,
            successMsg: successMsg,
            noMessages: !successMsg,
            helpers: {
                select: function (value, options) {
                    return options.fn()
                    .split('\n')
                    .map(function (v) {
                        var t = 'value="' + value + '"';
                        return RegExp(t).test(v) ? v.replace(t, t + ' selected="selected"') : v;
                    })
                    .join('\n');
                }
            }
        });
    });
});

router.get('/add-to-cart/:id', function(req, res, next) {
    var productId = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});

    Product.findById(productId, function(err, product) {
       if (err) {
           return res.redirect('/');
       }
        cart.add(product, product.id);
        req.session.cart = cart;
        console.log(req.session.cart);
        res.redirect('/');
    });
});

router.get('/reduce/:id', function(req, res, next) {
    var productId = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});

    cart.reduceByOne(productId);
    req.session.cart = cart;
    res.redirect('/shopping-cart');
});

router.get('/remove/:id', function(req, res, next) {
    var productId = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});

    cart.removeItem(productId);
    req.session.cart = cart;
    res.redirect('/shopping-cart');
});

router.get('/shopping-cart', function(req, res, next) {
   if (!req.session.cart) {
       return res.render('shop/shopping-cart', {products: null});
   } 
    var cart = new Cart(req.session.cart);
    res.render('shop/shopping-cart', {products: cart.generateArray(), totalPrice: cart.totalPrice});
});

router.get('/checkout', isLoggedIn, function(req, res, next) {
    if (!req.session.cart) {
        return res.redirect('/shopping-cart');
    }
    var cart = new Cart(req.session.cart);
    var errMsg = req.flash('error')[0];
    res.render('shop/checkout', {total: cart.totalPrice, errMsg: errMsg, noError: !errMsg});
});

router.get('/counts', isLoggedIn, function(req, res, next) {
    Productcount.find({}, function (err, docs) {
        var errMsg = "";
        if (err) {
            errMsg = "error finding counts " + err;
        }
        console.log(JSON.stringify(docs));
        res.render('shop/counts', {counts: docs, errMsg: errMsg, noError: !errMsg});
    });
});


router.get('/testemail', isLoggedIn, function(req, res, next) {
    User.findById(req.user, function(err, user){
        if (err) {
            console.log('could not find user for order!');
        }
        else{
            nodemailerMailgun.sendMail({
                from: 'teamjtree1@gmail.com',
                to: user.email, // An array if you have multiple recipients.
                subject: 'Hey! We got your order',
                'h:Reply-To': 'teamjtree1@gmail.com',
                //You can use "html:" to send HTML email content. It's magic!
                html: '<b>We got your order. You\'re on the Team</b><p>Here is what we got</p><ul><li>Thing 1</li><li>thing 2</li></ul>',
                text: '-jtree'
            }, function (err, info) {
                if (err) {
                    console.log('Error: ' + err);
                }
                else {
                    console.log('Response: ' + info);
                }
            });
        }
    });
    res.redirect('/');
});

router.post('/checkout', isLoggedIn, function(req, res, next) {
    if (!req.session.cart) {
        return res.redirect('/shopping-cart');
    }
    var cart = new Cart(req.session.cart);
    
    var stripe = require("stripe")(
    //    "sk_test_KPWxRxNRrISeE32cd7dqeNFM"
        process.env.STRIPE_SK
    );

    stripe.charges.create({
        amount: cart.totalPrice * 100,
        currency: "usd",
        source: req.body.stripeToken, // obtained with Stripe.js
        description: cart.generateMeta()
        //metadata: cart.generateMeta()
    }, function(err, charge) {
        if (err) {
            req.flash('error', err.message);
            return res.redirect('/checkout');
        }
        var order = new Order({
            user: req.user,
            cart: cart,
            address: req.body.address,
            name: req.body.name,
            paymentId: charge.id
        });

        var counts = cart.generateCounts();
        console.log('Counts: ' + JSON.stringify(counts));
        for (var i = 0; i < counts.length; i++) {
            Productcount.findOneAndUpdate({item: counts[i].num}, {$inc:counts[i].q}, {new: true}, function(err, doc) {
                if (err) {
                    console.log("Something wrong when updating data!");
                }
                console.log("Updated Order Counts: " + doc);
            });
        }

        User.findById(req.user, function(err, user){
            if (err) {
                console.log('could not find user for order!');
            }
            else{
                nodemailerMailgun.sendMail({
                    from: 'teamjtree1@gmail.com',
                    to: user.email, // An array if you have multiple recipients.
                    subject: 'Hey! We got your order',
                    'h:Reply-To': 'teamjtree1@gmail.com',
                    //You can use "html:" to send HTML email content. It's magic!
                    html: '<b>We got your order. You\'re on the Team</b><p>Here is what we got for you:</p>' + cart.generateHTML() + '<p>Now get on with you\'re training!</p>',
                    text: '-jtree'
                }, function (err, info) {
                    if (err) {
                        console.log('Error: ' + err);
                    }
                    else {
                        console.log('Response: ' + info);
                    }
                });
            }
        });



        order.save(function(err, result) {
            req.flash('success', 'Successfully bought product!');
            req.session.cart = null;
            res.redirect('/user/profile');
        });
    }); 
});

module.exports = router;

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.session.oldUrl = req.url;
    res.redirect('/user/signin');
}
