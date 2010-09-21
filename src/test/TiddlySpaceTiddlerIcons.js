(function(module, $) {

var _areIdentical;
var _Popup;
module("TiddlySpaceTiddlerIcons", {
	setup: function() {
		_areIdentical = config.macros.tiddlerOrigin.areIdentical;
		Popup = {
			create: function(place) {
				var popup = $("<div />").attr("id", "test_ttt_popup").appendTo(document.body);
				this.el = popup;
				return popup;
			},
			show: function() {
				$(this.el).show();
				this.hidden = false;
			},
			remove: function() {
				this.hidden = true;
			}
		}
		_Popup = Popup;
	},
	teardown: function() {
		store.removeTiddler("foo");
		store.removeTiddler("foo2");
		store.removeTiddler("boo [public]");
		config.macros.tiddlerOrigin.areIdentical = _areIdentical;
		Popup = _Popup;
	}
});

test("determineTiddlerType (shadow)", function() {
	var tiddler = new Tiddler("ToolbarCommands");
	var result = "";
	var callback = function(type) {
		result = type;
	};
	config.macros.tiddlerOrigin.determineTiddlerType(tiddler, {}, callback);
	strictEqual(result, "shadow");
});

test("determineTiddlerType (missing)", function() {
	var tiddler = new Tiddler("foo");
	var result = "";
	var callback = function(type) {
		result = type;
	};
	config.macros.tiddlerOrigin.determineTiddlerType(tiddler, {}, callback);
	strictEqual(result, "missing");
});

test("determineTiddlerType (external)", function() {
	// setup
	var space = { name: "bar" };
	var originMacro = config.macros.tiddlerOrigin;
	var tiddler = new Tiddler("foo");
	tiddler.fields["server.workspace"] = "recipes/foo_private";
	store.saveTiddler(tiddler);
	var result;
	var callback = function(type) {
		result = type;
	};

	// run
	originMacro.determineTiddlerType(tiddler, {space: space}, callback);
	strictEqual(result, "external");
});

test("determineTiddlerType (private / public)", function() {
	// setup
	var space = { name: "foo" };
	var originMacro = config.macros.tiddlerOrigin;
	var adaptor = function() {
		return {
			getTiddler: function() {}
		};
	};
	var tiddler = new Tiddler("foo");
	tiddler.fields["server.workspace"] = "recipes/foo_private";
	var tiddler2 = new Tiddler("foo2");
	tiddler2.fields["server.workspace"] = "bags/foo_private";
	tiddler.getAdaptor = adaptor;
	tiddler2.getAdaptor = adaptor;
	store.saveTiddler(tiddler);
	store.saveTiddler(tiddler2);
	var _distinguishPublicPrivateType = originMacro.distinguishPublicPrivateType;
	originMacro.distinguishPublicPrivateType = function(tiddler, options, type, callback) {
		callback("private");
	};

	var result;
	var callback = function(type) {
		result = type;
	};
	// run and test
	originMacro.determineTiddlerType(tiddler, { space: space }, callback);
	strictEqual(result, "private");

	// setup
	result = false;

	// run and test
	originMacro.determineTiddlerType(tiddler2, { space: space }, callback);
	strictEqual(result, "private");

	originMacro.distinguishPublicPrivateType = _distinguishPublicPrivateType;
});

test("distinguishPublicPrivateType", function() {
	// setup
	var originMacro = config.macros.tiddlerOrigin;
	originMacro.areIdentical = function(tiddler1, tiddler2) {
		return true;
	};
	var actual = [];
	var expected = ["private", "privateAndPublic", "public", "privateNotPublic"];
	var space = { name: "z" };
	var callback = function(type) {
		actual.push(type);
	};
	var getAdaptor = function() {
		var adaptor = {
			getTiddler: function(title, context) {
				var workspace = context.workspace;
				if(workspace == "bags/z_public" && title == "foo") { // test 1
					callback("private");
				} else if(workspace == "bags/z_private" && title == "goo") { // test 4
					callback("privateNotPublic");
				} else {
					callback(false);
				}
			}
		};
		return adaptor;
	};
	store.saveTiddler(new Tiddler("boo [public]"));
	var tiddler = new Tiddler("foo");
	var tiddler2 = new Tiddler("boo");
	var tiddler3 = new Tiddler("zoo [public]");
	tiddler3.fields["server.title"] = "zoo";
	var tiddler4 = new Tiddler("goo");

	tiddler.getAdaptor = getAdaptor;
	tiddler2.getAdaptor = getAdaptor;
	tiddler3.getAdaptor = getAdaptor;
	tiddler4.getAdaptor = getAdaptor;
	originMacro.distinguishPublicPrivateType(tiddler, {space: space}, "private", callback);
	originMacro.distinguishPublicPrivateType(tiddler2, {space: space}, "private", callback);
	originMacro.distinguishPublicPrivateType(tiddler3, {space: space}, "public", callback);
	originMacro.distinguishPublicPrivateType(tiddler4, {space: space}, "public", callback);
	same(expected, actual);
});

test("areIdentical (text and title)", function() {
	var originMacro = config.macros.tiddlerOrigin;
	var text = "hello world";
	var tiddler = new Tiddler("foo");
	var tiddler2 = new Tiddler("foo");
	tiddler.text = text;
	tiddler2.text = text;
	var actual = originMacro.areIdentical(tiddler, tiddler2);
	strictEqual(true, actual);
});

test("areIdentical (text, tags and title)", function() {
	var originMacro = config.macros.tiddlerOrigin;
	var text = "hello world";
	var tiddler = new Tiddler("foo");
	var tiddler2 = new Tiddler("foo");
	tiddler.text = text;
	tiddler2.text = text;
	tiddler.tags = ["foo"];
	tiddler2.tags = ["bar"];
	var actual = originMacro.areIdentical(tiddler, tiddler2);
	strictEqual(false, actual, "Tags are different");
});

test("areIdentical (text, tags and title with different server. fields)", function() {
	var originMacro = config.macros.tiddlerOrigin;
	var text = "hello world";
	var tiddler = new Tiddler("foo");
	var tiddler2 = new Tiddler("foo");
	tiddler.text = text;
	tiddler2.text = text;
	var tags = ["a", "b", "d", "z"];
	tiddler.tags = tags;
	tiddler2.tags = tags;
	tiddler.fields["server.workspace"] = "bags/x";
	tiddler2.fields["server.workspace"] = "bags/foo";
	tiddler.fields["server.page.revision"] = "2";
	tiddler2.fields["server.page.revision"] = "20";

	// run
	var actual = originMacro.areIdentical(tiddler, tiddler2);
	strictEqual(true, actual);
});

test("areIdentical (text, tags and title with different server. fields)", function() {
	var originMacro = config.macros.tiddlerOrigin;
	var tiddler = new Tiddler("foo");
	var tiddler2 = new Tiddler("foo");
	tiddler2.fields.fill = "red";

	// run
	var actual = originMacro.areIdentical(tiddler, tiddler2);
	strictEqual(false, actual);
});

test("_getLabelOptions", function() {
	var macro = config.macros.tiddlerOrigin;

	var options = macro._getLabelOptions([{}]);
	var options2 = macro._getLabelOptions([{ label: ["yes"] }]);
	var options3 = macro._getLabelOptions([{ label: ["no"], width: ["20"], height: ["20"] }]);
	strictEqual(options.includeLabel, true); // make sure its the default
	strictEqual(options2.includeLabel, true);
	strictEqual(options3.includeLabel, false);
});

var _readOnly;
module("TiddlySpaceTiddlerIcons readOnly mode", {
	setup: function() {
		_readOnly = readOnly;
		readOnly = true;
	},
	teardown: function() {
		readOnly = _readOnly;
	}
});

test("check concertina commands do not appear in readonly mode", function() {
	// setup
	var macro = config.macros.tiddlerOrigin;
	var place1 = $("<div />")[0];
	var place2 = $("<div />")[0];
	var tiddler = new Tiddler("foo");
	tiddler.getAdaptor = function() {
		return function() {};
	};
	// run
	macro.iconCommands.public(place1, tiddler);
	macro.iconCommands.private(place2, tiddler);

	// verify
	var selector = "input[type=checkbox], .publishButton";
	strictEqual($(selector, place1).length, 0);
	strictEqual($(selector, place2).length, 0);

});

test("confirm", function() {
	var macro = config.macros.tiddlerOrigin;
	var place = $("<div />");
	var ev = {
		target: place, 
		stopPropagation: function(){}
	};
	// run
	var clicked = false;
	macro.confirm(ev, "hello", function(ev) {
		clicked = true;
	});
	place = document.getElementById("test_ttt_popup");
	strictEqual($(".message", place).text(), "hello");
	strictEqual($("button", place).length, 2);
	var yes = $("button", place)[0];
	var no = $("button", place)[1];
	no.click();
	strictEqual(Popup.hidden, true);

	strictEqual(clicked, false);
	yes.click();
	strictEqual(clicked, true);
	
});
})(QUnit.module, jQuery);
