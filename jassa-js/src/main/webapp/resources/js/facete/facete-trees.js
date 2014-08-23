(function() {

    var rdf = Jassa.rdf;
	var sparql = Jassa.sparql;
	
	var ns = Jassa.facete;


	/**
	 * A class for generating variables for step-ids.
	 * So this class does not care about the concrete step taken.
	 * 
	 * @param variableName
	 * @param generator
	 * @param parent
	 * @param root
	 * @returns {ns.VarNode}
	 */
	ns.VarNode = Class.create({
		initialize: function(variableName, generator, stepId, parent, root) {
			this.variableName = variableName;
			this.generator = generator;
			this.stepId = stepId; // Null for root
			this.parent = parent;
			this.root = root;
			
			
			//console.log("VarNode status" , this);
			if(!this.root) {
				if(this.parent) {
					this.root = parent.root;
				}
				else {
					this.root = this;
				}
			}
	
			
			this.idToChild = {};
		},

		isRoot: function() {
			var result = this.parent ? false : true;
			return result;
		},

		/*
		getSourceVarName: function() {
			var result = this.root.variableName;
			return result;
		},
		*/
		
		getVariableName: function() {
			return this.variableName;
		},
		
		/*
		forPath: function(path) {
			var steps = path.getSteps();
			
			var result;
			if(steps.length === 0) {
				result = this;
			} else {
				var step = steps[0];
				
				// TODO Allow steps back
				
				result = forStep(step);
			}
			
			return result;
		},
		*/

		getIdStr: function() {
			var tmp = this.parent ? this.parent.getIdStr() : "";
			
			var result = tmp + this.variableName;
			return result;
		},

		getStepId: function(step) {
			return "" + JSON.stringify(step);
		},
		
		getSteps: function() {
			return this.steps;
		},
			
		/**
		 * Convenience method, uses forStep
		 * 
		 * @param propertyUri
		 * @param isInverse
		 * @returns
		 */
		forProperty: function(propertyUri, isInverse) {
			var step = new ns.Step(propertyUri, isInverse);
			
			var result = this.forStep(step);

			return result;
		},

		forStepId: function(stepId) {
			var child = this.idToChild[stepId];
			
			if(!child) {
				
				var subName = this.generator.next();
				child = new ns.VarNode(subName, this.generator, stepId, this);
				
				//Unless we change something
				// we do not add the node to the parent
				this.idToChild[stepId] = child;				
			}
			
			return child;
		},
		
		/*
		 * Recursively scans the tree, returning the first node
		 * whose varName matches. Null if none found.
		 * 
		 * TODO: Somehow cache the variable -> node mapping 
		 */
		findNodeByVarName: function(varName) {
			if(this.variableName === varName) {
				return this;
			}
			
			var children = _.values(this.idToChild);
			for(var i = 0; i < children.length; ++i) {
				var child = children[i];

				var tmp = child.findNodeByVarName(varName);
				if(tmp) {
					return tmp;
				}
			}
			
			return null;
		}
	});


	
	/**
	 * The idea of this class is to have a singe object
	 * for all this currently rather distributed facet stuff
	 * 
	 * 
	 * 
	 */
	ns.FacetManager = Class.create({
		initialize: function(varName, generator) { //rootNode, generator) {
			
			var varNode = new ns.VarNode(varName, generator);
			
			this.rootNode = new ns.FacetNode(varNode);
	
			//this.rootNode = rootNode;
			this.generator = generator;
		},
	
			/*
			create: function(varName, generator) {
				var v = checkNotNull(varName);
				var g = checkNotNull(generator);
				
				var rootNode = new ns.FacetNode(this, v);
				
				var result = new ns.FacetManager(rootNode, g);
				
				return result;
			},*/
		
		getRootNode: function() {
			return this.rootNode;
		},
		
		getGenerator: function() {
			return this.generator;
		}
	});
	
	
	/**
	 * Ties together a facetNode (only responsible for paths) and a constraint collection.
	 * Constraints can be declaratively set on the facade and are converted to
	 * appropriate constraints for the constraint collection.
	 * 
	 * e.g. from
	 * var constraint = {
	 * 	type: equals,
	 * 	path: ...,
	 * 	node: ...}
	 * 
	 * a constraint object is compiled.
	 * 
	 * 
	 * @param constraintManager
	 * @param facetNode
	 * @returns {ns.SimpleFacetFacade}
	 */
	ns.SimpleFacetFacade = Class.create({
		initialize: function(constraintManager, facetNode) {
			this.constraintManager = constraintManager;
			//this.facetNode = checkNotNull(facetNode);
			this.facetNode = facetNode;
		},

		getFacetNode: function() {
			return this.facetNode;
		},
		
		getVariable: function() {
			var result = this.facetNode.getVariable();
			return result;
		},
		
		getPath: function() {
			return this.facetNode.getPath();
		},
		
		forProperty: function(propertyName, isInverse) {
			var fn = this.facetNode.forProperty(propertyName, isInverse);
			var result = this.wrap(fn);
			return result;
		},
		
		forStep: function(step) {
			var fn = this.facetNode.forStep(step);
			var result = this.wrap(fn);
			return result;
		},
		
		wrap: function(facetNode) {
			var result = new ns.SimpleFacetFacade(this.constraintManager, facetNode);
			return result;
		},
		
		forPathStr: function(pathStr) {
			var path = ns.Path.fromString(pathStr);
			var result = this.forPath(path);
			
			//console.log("path result is", result);
			
			return result;
		},
		
		forPath: function(path) {
			var fn = this.facetNode.forPath(path);
			var result = this.wrap(fn);
			return result;
		},

		createConstraint: function(json) {
			if(json.type != "equals") {
				
				throw "Only equals supported";
			}
			
			var node = json.node;

			//checkNotNull(node);
			
			var nodeValue = sparql.NodeValue.makeNode(node);
      // FIXME: createEquals is not defined in ConstraintUtils
			var result = ns.ConstraintUtils.createEquals(this.facetNode.getPath(), nodeValue);
			
			return result;
		},
		
		/**
		 * 
		 * Support:
		 * { type: equals, value: }
		 * 
		 * 
		 * @param json
		 */
		addConstraint: function(json) {
			var constraint = this.createConstraint(json);				
			this.constraintManager.addConstraint(constraint);
		},
		
		removeConstraint: function(json) {
			var constraint = this.createConstraint(json);
      // FIXME: ConstraintManager class has no method moveConstraint (only removeConstraint)
			this.constraintManager.moveConstraint(constraint);				
		},
		
		// Returns the set of constraint that reference a path matching this one
		getConstraints: function() {
			var path = this.facetNode.getPath();
			var constraints = this.constraintManager.getConstraintsByPath(path);
			
			return constraints;
		},
		
		/**
		 * TODO: Should the result include the path triples even if there is no constraint? Currently it includes them.
		 * 
		 * Returns a concept for the values at this node.
		 * This concept can wrapped for getting the distinct value count
		 * 
		 * Also, the element can be extended with further elements
		 */
		createElements: function(includeSelfConstraints) {
			var rootNode = this.facetNode.getRootNode();
			var excludePath = includeSelfConstraints ? null : this.facetNode.getPath();
			
			// Create the constraint elements
			var elements = this.constraintManager.createElements(rootNode, excludePath);
			//console.log("___Constraint Elements:", elements);
			
			// Create the element for this path (if not exists)
			var pathElements = this.facetNode.getElements();
			//console.log("___Path Elements:", elements);
			
			elements.push.apply(elements, pathElements);
			
			var result = sparql.ElementUtils.flatten(elements);
			//console.log("Flattened: ", result);
			
			// Remove duplicates
			
			return result;
		},
		
		
		/**
		 * Creates the corresponding concept for the given node.
		 * 
		 * @param includeSelfConstraints Whether the created concept should
		 *        include constraints that affect the variable
		 *        corresponding to this node. 
		 * 
		 */
		createConcept: function(includeSelfConstraints) {
			var elements = this.createElements(includeSelfConstraints);
			//var element = new sparql.ElementGroup(elements);
			var v = this.getVariable();
			
			var result = new ns.Concept(elements, v);
			return result;
		},
		
		
		/**
		 * Returns a list of steps of _this_ node for which constraints exist
		 * 
		 * Use the filter to only select steps that e.g. correspond to outgoing properties
		 */
		getConstrainedSteps: function() {
			var path = this.getPath();
			var result = this.constraintManager.getConstrainedSteps(path);
			return result;
		}
	});
			
			/**
			 * Returns a list of steps for _this_ node for which constraints exists
			 * 
			 */
			
			
			
			
			/**
			 * Creates a util class for common facet needs:
			 * - Create a concept for sub-facets
			 * - Create a concept for the facet values
			 * - ? more?
			 */
			/*
			createUtils: function() {
				
			}
			*/

})();

