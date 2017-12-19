var express = require('express');
var router = express.Router();
var Cart = require('../models/cart');

var User = require('../models/user');
var Product = require('../models/product');
var Productcount = require('../models/productcount');
var Order = require('../models/order');

var nodemailer = require('nodemailer');
var mg = require('nodemailer-mailgun-transport');

var async = require('async');

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
    res.render('shop/shopping-cart', {products: cart.generateArray(), totalPrice: cart.totalPrice,  subTotal: cart.subtotal, serviceFee: cart.serviceFee, shippingFee: cart.shippingFee});
});

router.get('/checkout', isLoggedIn, function(req, res, next) {
    if (!req.session.cart) {
        return res.redirect('/shopping-cart');
    }
    var cart = new Cart(req.session.cart);
    var errMsg = req.flash('error')[0];
    res.render('shop/checkout', {total: cart.totalPrice, errMsg: errMsg, noError: !errMsg});
});

getSum = function (doc) {
    doc['sum'] = 0;
    doc['val'] = 0;
    doc.sum = doc.XS + doc.SM + doc.MD + doc.LG + doc.XL + doc.XXL + doc.XXXL;
    console.log(doc.item + ' = ' + doc.sum);
    doc.val = doc.price * doc.sum;
    return doc;
};

getPeeps = function (item,size,cb) {
    var peeps = new Array();
    async.waterfall([
        function (callback) {
            Product.find({item: item, size: size}, function (err, product) {
                if(err) console.log ('err finding product: ' + err);
                //console.log(product);
                var qstr = product[0]._id;
                //console.log('generated qstr: ' + qstr);
                callback(null, qstr);
            })
        },
        function (qstr, callback) {
            //console.log('about to search for Orders with ' + qstr);
            var qstr2 = 'cart.items.' + qstr;
            var q = {};
            q[qstr2] = {$exists: true};
            //console.log('about to search for Orders with ' + JSON.stringify(q));
            Order.find(q, function (err, orders) {
                // console.log(orders);
                if (typeof orders !== 'undefined' && orders.length > 0) {
                    orders.forEach(function (value) {
                        peeps.push(value.name + " (" + value.cart.items[qstr].qty + ")")
                    });
                    //console.log('found '+ orders.length + ' orders from: ' + peeps);
                }
                callback(null)
            })
        }
    ], function (err, results) {
        if (err) console.log('error during waterfall');
        // if (peeps.length < 1) peeps = ['no one'];
        // console.log('calling back peeps: ' + peeps);
        cb(peeps);
    });

};

router.get('/counts', isLoggedIn, function(req, res, next) {
    var counts = new Array();
    var totalVal = 0;
    Productcount.find({}, function (err, docs) {
        var errMsg = "";
        if (err) {
            errMsg = "error finding counts " + err;
        }
        async.each(docs, function (doc, callback) {
            var count = new Object();
            count.item = doc.item;
            count.XS = doc.XS;
            count.SM = doc.SM;
            count.MD = doc.MD;
            count.LG = doc.LG;
            count.XL = doc.XL;
            count.XXL = doc.XXL;
            count.XXXL = doc.XXXL;
            count.title = doc.title;

            var sum = 0;
            sum = count.XS + count.SM + count.MD + count.LG + count.XL + count.XXL + count.XXXL;
            count.sum = sum;
            count.value = sum * doc.price;
            totalVal += count.value;
            count.peeps = {};

            async.each(['XS', 'SM', 'MD', 'LG', 'XL', 'XXL', 'XXXL'], function (size, callback2) {
                getPeeps(count.item, size, function (peeps) {
                    count.peeps[size] = peeps;
                    callback2();
                });
            }, function (err) {
                if (err) console.log('err in getPeeps ' + err);
                counts.push(count);
                // console.log('pushed count: ' + JSON.stringify(count));
                callback();
            });
        }, function (err) {
            // console.log("About to render counts " + JSON.stringify(counts));
            res.render('shop/counts', {counts: counts, total:totalVal, errMsg: errMsg, noError: !errMsg});
        });
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

function round(value, decimals) {
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}

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
        amount: round(cart.totalPrice * 100,0),
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
