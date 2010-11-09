"""
ControlView is for protecting the pope (PTP).

Jermoelen says:

The PTP issue boiled down to a desire that it should not be possible to
reach tiddler content via a space URI unless that content has been
explicitly stored or included into the space.

The goal was to avoid mischievous people being able to construct URIs
that made it look as though arbitrary content were part of a target
space. Imagine an organisation using the bring your own domain feature
to implement http://mysite.org/ on TiddlySpace. They prepare lots of
content and share it with their community. Then imagine a mischievous
person who wants to make it appear as though http://mysite.org/ were
illegally hosting copyrighted materials. He can upload the material to
his own space, and then, without ControlView, he can construct a URI
that starts with http://mysite.org/ but points to the illegal content.
To a reasonably knowledgeable user, it would look as though the
copyright content were hosted on http://mysite.org/.

The example isn't to suggest that the feature is intended to protect
copyright holders; it's more about protecting groups and individuals
from defamation and fraud.
"""

from tiddlyweb.control import recipe_template
from tiddlyweb.filters import parse_for_filters
from tiddlyweb.model.recipe import Recipe
from tiddlyweb.store import NoRecipeError
from tiddlyweb.web.http import HTTP404

from tiddlywebplugins.tiddlyspace.handler import (determine_host,
        determine_space, determine_space_recipe,
        ADMIN_BAGS)

class ControlView(object):
    """
    WSGI Middleware which adapts an incoming request to restrict what
    entities from the store are visible to the requestor. The effective
    result is that only those bags and recipes contained in the current
    space are visible in the HTTP routes.
    """

    def __init__(self, application):
        self.application = application

    def __call__(self, environ, start_response):
        req_uri = environ.get('SCRIPT_NAME', '') + environ.get('PATH_INFO', '')

        if (req_uri.startswith('/bags')
                or req_uri.startswith('/search')
                or req_uri.startswith('/recipes')):
            self._handle_core_request(environ, req_uri)

        return self.application(environ, start_response)

    # XXX too long!
    def _handle_core_request(self, environ, req_uri):
        """
        Override a core request, adding filters or sending 404s where
        necessary to limit the view of entities.

        filtering can be disabled with a custom HTTP header X-ControlView set
        to false
        """
        http_host, host_url = determine_host(environ)

        request_method = environ['REQUEST_METHOD']

        disable_ControlView = environ.get('HTTP_X_CONTROLVIEW') == 'false'
        if http_host != host_url and not disable_ControlView:
            space_name = determine_space(environ, http_host)
            if space_name == None:
                return
            recipe_name = determine_space_recipe(environ, space_name)
            store = environ['tiddlyweb.store']
            try:
                recipe = store.get(Recipe(recipe_name))
            except NoRecipeError, exc:
                raise HTTP404('No recipe for space: %s', exc)

            template = recipe_template(environ)
            bags = ['%s_archive' % space_name]
            subscriptions = []
            for bag, _ in recipe.get_recipe(template):
                bags.append(bag)
                if (bag.endswith('_public') and
                        not bag.startswith('%s_p' % space_name)):
                    subscriptions.append(bag[:-7])
            bags.extend(ADMIN_BAGS)

            filter_string = None
            if req_uri.startswith('/recipes') and req_uri.count('/') == 1:
                filter_string = 'oom=name:'
                if recipe_name.endswith('_private'):
                    filter_parts = ['%s_%s' % (space_name, status)
                            for status in ('private', 'public')]
                else:
                    filter_parts = ['%s_public' % space_name]
                for subscription in subscriptions:
                    filter_parts.append('%s_public' % subscription)
                filter_string += ','.join(filter_parts)
            elif req_uri.startswith('/bags') and req_uri.count('/') == 1:
                filter_string = 'oom=name:'
                filter_parts = []
                for bag in bags:
                    filter_parts.append('%s' % bag)
                filter_string += ','.join(filter_parts)
            elif req_uri.startswith('/search') and req_uri.count('/') == 1:
                filter_string = 'oom=bag:'
                filter_parts = []
                for bag in bags:
                    filter_parts.append('%s' % bag)
                filter_string += ','.join(filter_parts)
            else:
                entity_name = req_uri.split('/')[2]
                if '/recipes/' in req_uri:
                    valid_recipes = ['%s_%s' % (space_name, status)
                            for status in ('private', 'public')]
                    valid_recipes += ['%s_public' % _space_name
                            for _space_name in subscriptions]
                    if entity_name not in valid_recipes:
                        raise HTTP404('recipe %s not found' % entity_name)
                else:
                    if entity_name not in bags:
                        raise HTTP404('bag %s not found' % entity_name)

            if filter_string:
                filters, _ = parse_for_filters(filter_string)
                for single_filter in filters:
                    environ['tiddlyweb.filters'].insert(0, single_filter)
