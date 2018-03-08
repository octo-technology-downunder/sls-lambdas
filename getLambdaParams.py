import yaml
import sys

config_stream = open('serverless.yml', 'r')
config = yaml.safe_load(config_stream)
yaml_stream = True

print config['functions'][sys.argv[1]][sys.argv[2]]
