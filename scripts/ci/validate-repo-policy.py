#!/usr/bin/env python3
"""Validate .partrunner/repo-policy.yml with PyYAML SafeLoader.

This is the repository delivery-policy schema check. It parses the manifest with
PyYAML's SafeLoader and a strict mapping constructor that rejects duplicate keys,
then checks the structured invariants the delivery flow depends on.

Usage:
    python3 scripts/ci/validate-repo-policy.py [.partrunner/repo-policy.yml]

Exit codes: 0 valid, 1 invalid or unreadable. Failures are printed as GitHub
`::error::` lines. No network access, no writes.
"""

import sys

import yaml

MERGE_METHODS = {"merge", "squash", "rebase"}
REVIEW_REQUIREMENTS = {"required", "optional", "none"}
REVIEW_ENFORCEMENT = {"blocking", "advisory_in_pilot", "advisory", "none"}
BRANCHES = {"staging", "main"}
NAME_PATTERN = "Partrunner-ai/"


class StrictLoader(yaml.SafeLoader):
    """SafeLoader that refuses duplicate mapping keys instead of overwriting."""


def _construct_mapping(loader, node, deep=False):
    if not isinstance(node, yaml.MappingNode):
        raise yaml.constructor.ConstructorError(
            None, None, "expected a mapping node", node.start_mark
        )
    mapping = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        try:
            duplicate = key in mapping
        except TypeError:
            raise yaml.constructor.ConstructorError(
                None, None, "mapping keys must be scalars", key_node.start_mark
            )
        if duplicate:
            raise yaml.constructor.ConstructorError(
                None, None, "duplicate key: %r" % (key,), key_node.start_mark
            )
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping


StrictLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _construct_mapping
)


def _is_mapping(value):
    return isinstance(value, dict)


def _is_string(value):
    return isinstance(value, str) and value != ""


def _is_string_list(value):
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def validate(policy):
    errors = []
    if not _is_mapping(policy):
        return ["policy must be a top-level mapping"]

    if policy.get("version") != 1:
        errors.append("version must be 1")

    repository = policy.get("repository")
    if not _is_mapping(repository):
        errors.append("repository must be a mapping")
    else:
        name = repository.get("name")
        if not _is_string(name) or not name.startswith(NAME_PATTERN):
            errors.append("repository.name must be an owner/repo slug")
        for key in ("integration_branch", "production_branch"):
            if repository.get(key) not in BRANCHES:
                errors.append("repository.%s must be staging or main" % key)

    context = policy.get("context")
    if not _is_mapping(context):
        errors.append("context must be a mapping")
    else:
        for key in ("file", "instructions"):
            value = context.get(key)
            if not _is_string(value) or not value.endswith(".md"):
                errors.append("context.%s must be a Markdown path" % key)

    integration = repository.get("integration_branch") if _is_mapping(repository) else None
    production = repository.get("production_branch") if _is_mapping(repository) else None

    pull_requests = policy.get("pull_requests")
    if not _is_mapping(pull_requests):
        errors.append("pull_requests must be a mapping")
    else:
        feature_base = pull_requests.get("feature_base")
        if not _is_string(feature_base):
            errors.append("pull_requests.feature_base is required")
        elif feature_base != integration:
            errors.append(
                "pull_requests.feature_base must match repository.integration_branch"
            )
        feature_merge = pull_requests.get("feature_merge")
        if feature_merge not in MERGE_METHODS:
            errors.append(
                "pull_requests.feature_merge must be one of %s"
                % ", ".join(sorted(MERGE_METHODS))
            )
        never = pull_requests.get("never")
        if never is not None:
            if not _is_string_list(never):
                errors.append("pull_requests.never must be a list of merge methods")
            elif feature_merge in never:
                errors.append("pull_requests.feature_merge must not appear in pull_requests.never")
        promotion = pull_requests.get("promotion")
        if integration and production and integration != production:
            if not _is_mapping(promotion):
                errors.append(
                    "pull_requests.promotion must declare source and target when branches differ"
                )
            else:
                if promotion.get("source") != integration:
                    errors.append("pull_requests.promotion.source must be the integration branch")
                if promotion.get("target") != production:
                    errors.append("pull_requests.promotion.target must be the production branch")
                promotion_merge = promotion.get("merge")
                if promotion_merge not in MERGE_METHODS:
                    errors.append(
                        "pull_requests.promotion.merge must be one of %s"
                        % ", ".join(sorted(MERGE_METHODS))
                    )
                promotion_never = promotion.get("never")
                if promotion_never is not None:
                    if not _is_string_list(promotion_never):
                        errors.append("pull_requests.promotion.never must be a list")
                    elif promotion_merge in promotion_never:
                        errors.append(
                            "pull_requests.promotion.merge must not appear in promotion.never"
                        )
        elif promotion is not None and not _is_mapping(promotion) and promotion != "none":
            errors.append("pull_requests.promotion must be none or a mapping")

    enforcement = policy.get("enforcement")
    if enforcement is not None:
        if not _is_mapping(enforcement):
            errors.append("enforcement must be a mapping")
        else:
            merge_methods = enforcement.get("merge_methods")
            if merge_methods is not None:
                if not _is_mapping(merge_methods):
                    errors.append("enforcement.merge_methods must be a mapping")
                else:
                    for key in ("repository", "staging", "main"):
                        if key in merge_methods and not _is_string_list(merge_methods.get(key)):
                            errors.append(
                                "enforcement.merge_methods.%s must be a list" % key
                            )
                    staging_methods = merge_methods.get("staging")
                    feature_merge = (
                        pull_requests.get("feature_merge") if _is_mapping(pull_requests) else None
                    )
                    if (
                        integration == "staging"
                        and _is_string_list(staging_methods)
                        and feature_merge not in staging_methods
                    ):
                        errors.append(
                            "pull_requests.feature_merge must be allowed by enforcement.merge_methods.staging"
                        )

    review = policy.get("review")
    if not _is_mapping(review):
        errors.append("review must be a mapping")
    else:
        human = review.get("human")
        if not _is_mapping(human):
            errors.append("review.human must be a mapping")
        else:
            if human.get("requirement") not in REVIEW_REQUIREMENTS:
                errors.append(
                    "review.human.requirement must be one of %s"
                    % ", ".join(sorted(REVIEW_REQUIREMENTS))
                )
            if human.get("enforcement") not in REVIEW_ENFORCEMENT:
                errors.append(
                    "review.human.enforcement must be one of %s"
                    % ", ".join(sorted(REVIEW_ENFORCEMENT))
                )
        agent = review.get("agent")
        if agent is not None:
            if not _is_mapping(agent):
                errors.append("review.agent must be a mapping")
            else:
                requirement = agent.get("change_review")
                if requirement is not None and requirement not in REVIEW_REQUIREMENTS:
                    errors.append(
                        "review.agent.change_review must be one of %s"
                        % ", ".join(sorted(REVIEW_REQUIREMENTS))
                    )

    if not isinstance(policy.get("database_changes"), list):
        errors.append("database_changes must be a list (possibly empty)")

    deployment = policy.get("deployment")
    if not _is_mapping(deployment) or not deployment:
        errors.append("deployment must be a non-empty mapping")

    docs_only = policy.get("docs_only")
    if docs_only is not None:
        if not _is_mapping(docs_only):
            errors.append("docs_only must be a mapping")
        else:
            if not _is_string(docs_only.get("lane")):
                errors.append("docs_only.lane must be a script path")
            validation = docs_only.get("validation")
            if not _is_string_list(validation) or not validation:
                errors.append("docs_only.validation must be a non-empty list of commands")
            for key in ("policy", "preview", "limit"):
                if key in docs_only and not _is_string(docs_only.get(key)):
                    errors.append("docs_only.%s must be a string" % key)

    return errors


def main(argv):
    path = argv[1] if len(argv) > 1 else ".partrunner/repo-policy.yml"
    try:
        with open(path, "r", encoding="utf-8") as handle:
            policy = yaml.load(handle, Loader=StrictLoader)
    except yaml.YAMLError as error:
        print("::error::%s is not valid YAML: %s" % (path, str(error).replace("\n", " ")), file=sys.stderr)
        return 1
    except OSError as error:
        print("::error::cannot read %s: %s" % (path, error), file=sys.stderr)
        return 1

    errors = validate(policy)
    if errors:
        for error in errors:
            print("::error::%s" % error, file=sys.stderr)
        return 1

    print("%s is valid." % path)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
