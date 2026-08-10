import sys
import traceback
try:
    import api.app
    print("Success")
except BaseException as e:
    with open("error.txt", "w") as f:
        traceback.print_exc(file=f)
