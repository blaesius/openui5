/*!
 * ${copyright}
 */

// Provides class sap.ui.dt.ManagedObjectObserver.
sap.ui.define([
	'sap/ui/base/ManagedObject',
	'sap/ui/dt/ElementUtil'
],
function(ManagedObject, ElementUtil) {
	"use strict";


	/**
	 * Constructor for a new ManagedObjectObserver.
	 *
	 * @param {string} [sId] id for the new object, generated automatically if no id is given 
	 * @param {object} [mSettings] initial settings for the new object
	 *
	 * @class
	 * The ManagedObjectObserver observes changes of a ManagedObject and propagates them via events.
	 * @extends sap.ui.base.ManagedObject
	 *
	 * @author SAP SE
	 * @version ${version}
	 *
	 * @constructor
	 * @private
	 * @since 1.30
	 * @alias sap.ui.dt.ManagedObjectObserver
	 * @experimental Since 1.30. This class is experimental and provides only limited functionality. Also the API might be modified in future.
	 */
	var ManagedObjectObserver = ManagedObject.extend("sap.ui.dt.ManagedObjectObserver", /** @lends sap.ui.dt.ManagedObjectObserver.prototype */ {
		metadata : {
			"abstract" : true,
			// ---- object ----

			// ---- control specific ----
			library : "sap.ui.dt",
			properties : {
				
			},
			associations : {
				/**
				 * target ManagedObject to observe
				 */
				target : {
					type : "sap.ui.base.ManagedObject"
				}
			},
			events : {
				/**
				 *  Event fired when the observed object is modified
				 */
				modified : {
					parameters : {
						type : "string",
						value : "any",
						oldValue : "any",
						target : "sap.ui.core.Element"
					}
				},
				destroyed : {}
			}
		}
	});

	/**
	 * Called when the ManagedObjectObserver is created
	 * @protected
	 */
	ManagedObjectObserver.prototype.init = function() {};

	/**
	 * Called when the ManagedObjectObserver is destroyed
	 * @protected
	 */
	ManagedObjectObserver.prototype.exit = function() {
		var oTarget = this.getTargetInstance();
		if (oTarget) {
			this.unobserve(oTarget);	
		}
	};

	/**
	 * Sets a target ManagedObject to observe
	 * @param {string|sap.ui.base.ManagedObject} vTarget id or managed object to set
	 * @return {sap.ui.dt.ManagedObjectObserver} returns this
	 */
	ManagedObjectObserver.prototype.setTarget = function(vTarget) {
		var oOldTarget = this.getTargetInstance();
		if (oOldTarget) {
			this.unobserve(oOldTarget);	
		}

		this.setAssociation("target", vTarget);

		var oTarget = this.getTargetInstance();
		if (oTarget) {
			this.observe(oTarget);	
		}

		return this;
	};

	/**
	 * Starts observing the target object. Override this method in classes wich extend ManagedObjectObserver.
	 * @param {sap.ui.base.ManagedObject} oTarget The target to observe
	 * @protected
	 */
	ManagedObjectObserver.prototype.observe = function(oTarget) {
		var that = this;

		oTarget.attachEvent("_change", this.fireModified, this);

		// Wrapper for the destroy method to recognize changes
		var fnOriginalDestroy = this._fnOriginalDestroy = oTarget.destroy;
		var bDestroyed = false;
		oTarget.destroy = function() {
			if (bDestroyed) {
				return;
			}
			that.unobserve(oTarget);
			var vOriginalReturn = fnOriginalDestroy.apply(this, arguments);
			that.fireDestroyed();

			return vOriginalReturn;
		};

		// Wrapper for the bindProperty method to recognize changes
		this._fnOriginalBindProperty = oTarget.bindProperty;
		oTarget.bindProperty = function() {
			var vOriginalReturn = that._fnOriginalBindProperty.apply(this, arguments);
			that.fireModified();

			return vOriginalReturn;
		};

		// Wrapper for the unbindProperty method to recognize changes
		this._fnOriginalUnBindProperty = oTarget.unbindProperty;
		oTarget.unbindProperty = function() {
			var vOriginalReturn = that._fnOriginalUnBindProperty.apply(this, arguments);
			that.fireModified();

			return vOriginalReturn;
		};

		// Wrapper for the bindAggregation method to recognize changes
		this._fnOriginalBindAggregation = oTarget.bindAggregation;
		oTarget.bindAggregation = function(sAggregationName) {
			var vOriginalReturn = that._fnOriginalBindAggregation.apply(this, arguments);
			that.fireModified();

			return vOriginalReturn;
		};

		// Wrapper for the unbindAggregation method to recognize changes
		this._fnOriginalUnBindAggregation = oTarget.unbindAggregation;
		oTarget.unbindAggregation = function(sAggregationName) {
			var vOriginalReturn = that._fnOriginalUnBindAggregation.apply(this, arguments);
			that.fireModified();

			return vOriginalReturn;
		};

		// We wrap the native setParent method of the control with our logic
		this._fnOriginalSetParent = oTarget.setParent;
		oTarget.setParent = function(oParent, sAggregationName, bSuppressInvalidate) {
			var bFireModified = false;
			if (!this._bInSetParent) {
				bFireModified = true;
				this._bInSetParent = true;
			}

			var oCurrentParent = this.getParent();
			var vOriginalReturn = that._fnOriginalSetParent.apply(this, arguments);
			if (bFireModified && !this.__bSapUiDtSupressParentChangeEvent) {
				this._bInSetParent = false;
				if (oCurrentParent !== oParent) {
					that.fireModified({
						type : "setParent",
						value : oParent,
						oldValue : oCurrentParent,
						target : this
					});
				}
			}

			return vOriginalReturn;
		};

		// We wrap the native addAggregation method of the control with our logic
		this._fnOriginalAddAggregation = oTarget.addAggregation;
		oTarget.addAggregation = function(sAggregationName, oObject, bSuppressInvalidate) {
			that._bAddAggregationCall = true;
			var vOriginalReturn = that._fnOriginalAddAggregation.apply(this, arguments);
			that.fireModified({
				type : "addAggregation",
				value : oObject,
				target : this
			});
			return vOriginalReturn;
		};

		// We wrap the native removeAggregation method of the control with our logic
		this._fnOriginalRemoveAggregation = oTarget.removeAggregation;
		oTarget.removeAggregation = function(sAggregationName, vObject, bSuppressInvalidate) {
			var vOriginalReturn = that._fnOriginalRemoveAggregation.apply(this, arguments);
			that.fireModified({
				type : "removeAggregation",
				value : vObject,
				target : this
			});
			return vOriginalReturn;
		};

		// We wrap the native insertAggregation method of the control with our logic
		this._fnOriginalInsertAggregation = oTarget.insertAggregation;
		oTarget.insertAggregation = function(sAggregationName, oObject, iIndex, bSuppressInvalidate) {
			that._bInsertAggregationCall = true;
			var vOriginalReturn = that._fnOriginalInsertAggregation.apply(this, arguments);
			that.fireModified({
				type : "insertAggregation",
				value : oObject,
				target : this
			});
			return vOriginalReturn;
		};

		// We wrap the native removeAllAggregations method of the control with our logic
		this._fnOriginalRemoveAllAggregations = oTarget.removeAllAggregations;
		oTarget.removeAllAggregations = function(sAggregationName, bSuppressInvalidate) {
			var aRemovedObjects = this.getAggregation(sAggregationName);
			var vOriginalReturn = that._fnOriginalRemoveAllAggregations.apply(this, arguments);
			that.fireModified({
				type : "removeAllAggregations",
				value : aRemovedObjects,
				target : this
			});
			return vOriginalReturn;
		};

		// We wrap the native destroyAggregation method of the control with our logic
		this._fnOriginalDestroyAggregation = oTarget.destroyAggregation;
		oTarget.destroyAggregation = function(sAggregationName, bSuppressInvalidate) {
			var aRemovedObjects = this.getAggregation(sAggregationName);
			var vOriginalReturn = that._fnOriginalDestroyAggregation.apply(this, arguments);
			that.fireModified({
				type : "destroyAggregation",
				value : aRemovedObjects,
				target : this
			});
			return vOriginalReturn;
		};		

		that._aOriginalAddMutators = {};
		that._aOriginalInsertMutators = {};
		var mAllAggregations = oTarget.getMetadata().getAllAggregations();
		Object.keys(mAllAggregations).forEach(function(sAggregationName) {
			var oAggregation = mAllAggregations[sAggregationName];
			var _fnOriginalAddMutator = oTarget[oAggregation._sMutator];
			that._aOriginalAddMutators[oAggregation.name] = _fnOriginalAddMutator;
			oTarget[oAggregation._sMutator] = function(oObject) {
				that._bAddAggregationCall = false;
				// if addAggregation method wasn't called directly
				var vOriginalReturn = _fnOriginalAddMutator.apply(this, arguments);
				if (!that._bAddAggregationCall) {
					that.fireModified({
						type : "addAggregation",
						value : oObject,
						target : this
					});
				}
				return vOriginalReturn;
			};		

			var _fnOriginalInsertMutator = oTarget[oAggregation._sInsertMutator];
			that._aOriginalInsertMutators[oAggregation.name] = _fnOriginalInsertMutator;
			oTarget[oAggregation._sInsertMutator] = function(oObject, iIndex) {
				that._bInsertAggregationCall = false;
				var vOriginalReturn = _fnOriginalInsertMutator.apply(this, arguments);
				// if insertAggregation method wasn't called directly
				if (!that._bInsertAggregationCall) {
					that.fireModified({
						type : "insertAggregation",
						value : oObject,
						target : this
					});
				}
				return vOriginalReturn;
			};	
		});

	};

	/**
	 * Stops observing the target object. Override this method in classes wich extend ManagedObjectObserver.
	 * @param {sap.ui.base.ManagedObject} oTarget The target to unobserve
	 * @protected
	 */
	ManagedObjectObserver.prototype.unobserve = function(oTarget) {
		var that = this;

		oTarget.destroy = this._fnOriginalDestroy;
		delete this._fnOriginalDestroy;
		oTarget.bindProperty = this._fnOriginalBindProperty;
		delete this._fnOriginalBindProperty;
		oTarget.unbindProperty = this._fnOriginalUnBindProperty;
		delete this._fnOriginalUnBindProperty;
		oTarget.bindAggregation = this._fnOriginalBindAggregation;
		delete this._fnOriginalBindAggregation;
		oTarget.unbindAggregation = this._fnOriginalUnBindAggregation;
		delete this._fnOriginalUnBindAggregation;
		oTarget.setParent = this._fnOriginalSetParent;
		delete this._fnOriginalSetParent;

		oTarget.addAggregation = this._fnOriginalAddAggregation;
		delete this._fnOriginalAddAggregation;
		oTarget.removeAggregation = this._fnOriginalRemoveAggregation;
		delete this._fnOriginalRemoveAggregation;
		oTarget.insertAggregation = this._fnOriginalInsertAggregation;
		delete this._fnOriginalInsertAggregation;
		oTarget.removeAllAggregations = this._fnOriginalRemoveAllAggregations;
		delete this._fnOriginalRemoveAllAggregations;
		oTarget.destroyAggregation = this._fnOriginalDestroyAggregation;
		delete this._fnOriginalDestroyAggregation;

		var mAllAggregations = oTarget.getMetadata().getAllAggregations();
		Object.keys(mAllAggregations).forEach(function(sAggregationName) {
			var oAggregation = mAllAggregations[sAggregationName];
			oTarget[oAggregation._sMutator] = that._aOriginalAddMutators[oAggregation.name];
			oTarget[oAggregation._sInsertMutator] = that._aOriginalInsertMutators[oAggregation.name];
		});
		delete this._aOriginalAddMutators;
		delete this._aOriginalInsertMutators;

		oTarget.detachEvent("_change", this.fireModified, this);
	};


	/**
	 * @protected
	 * @return {sap.ui.base.ManagedObject} The instance of the associated target to observe.
	 */
	ManagedObjectObserver.prototype.getTargetInstance = function() {
		return sap.ui.getCore().byId(this.getTarget());
	};

	return ManagedObjectObserver;
}, /* bExport= */ true);
