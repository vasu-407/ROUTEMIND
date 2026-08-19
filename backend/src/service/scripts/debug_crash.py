import sys
with open('debug_out.txt', 'w') as f:
    f.write("starting...\n")
    f.flush()
    try:
        f.write("import core.models\n")
        f.flush()
        import core.models
        f.write("import engines.data_loader\n")
        f.flush()
        import engines.data_loader
        f.write("import engines.optimization\n")
        f.flush()
        import engines.optimization
        f.write("import engines.event_handler\n")
        f.flush()
        import engines.event_handler
        f.write("import api.app\n")
        f.flush()
        import api.app
        f.write("DONE\n")
        f.flush()
    except BaseException as e:
        f.write(f"Exception: {e}\n")
        f.flush()
        sys.exit(1)
