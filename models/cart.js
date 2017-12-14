module.exports = function Cart(oldCart) {
    this.items = oldCart.items || {};
    this.totalQty = oldCart.totalQty || 0;
    this.totalPrice = oldCart.totalPrice || 0;

    this.add = function(item, id) {
        var storedItem = this.items[id];
        if (!storedItem) {
            storedItem = this.items[id] = {item: item, qty: 0, price: 0};
        }
        storedItem.qty++;
        storedItem.price = storedItem.item.price * storedItem.qty;
        this.totalQty++;
        this.totalPrice += storedItem.item.price;
    };

    this.reduceByOne = function(id) {
        this.items[id].qty--;
        this.items[id].price -= this.items[id].item.price;
        this.totalQty--;
        this.totalPrice -= this.items[id].item.price;

        if (this.items[id].qty <= 0) {
            delete this.items[id];
        }
    };

    this.removeItem = function(id) {
        this.totalQty -= this.items[id].qty;
        this.totalPrice -= this.items[id].price;
        delete this.items[id];
    };

    this.generateArray = function() {
        var arr = [];
        for (var id in this.items) {
            arr.push(this.items[id]);
        }
        return arr;
    };
    this.generateMeta = function() {
        var meta = "";
        for (var id in this.items) {
            if (meta.length > 1)
                meta = meta + "\n";
            meta = meta +
                "qty: " + this.items[id].qty +
                ", price: " + this.items[id].price +
                ", desc: " + this.items[id].item.description
        }
        console.log(meta);
        return meta;
    };
    this.generateHTML = function() {
        var meta = "<div><ul>";
        for (var id in this.items) {
            meta = meta +
                "<li>" + this.items[id].item.description +
                "</li><ul><li>Qty: "+ this.items[id].qty + "</li><li>Size: "+this.items[id].item.size +"</li><li>Price: "+this.items[id].price+"</li></ul>"
        }
        meta = meta + "</ul></div>";
        return meta;
    };
    this.generateCounts = function() {
        var counts = [];
        for (var id in this.items) {
            var num = this.items[id].item.item;
            var sz = this.items[id].item.size;
            var cnt = this.items[id].qty;
            var query = {};
            query[sz] = cnt;

            var item = {
                num: num,
                q: query
            };

            counts.push(item);
        }
        return counts;
    };
};