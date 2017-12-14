var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    imagePath: {type: String, required: true},
    title: {type: String, required: true},
    price: {type: Number, required: true},
    item: {type: String, required: true},
    XS: {type: Number, required: true},
    SM: {type: Number, required: true},
    MD: {type: Number, required: true},
    LG: {type: Number, required: true},
    XL: {type: Number, required: true},
    XXL: {type: Number, required: true},
    XXXL: {type: Number, required: true},
});

module.exports = mongoose.model('Productcount', schema);