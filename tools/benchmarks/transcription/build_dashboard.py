"""Legacy command entry point for the interactive dashboard builder.
Use node dashboard/build.ts directly for new workflows. No chart rasterization.
"""
import subprocess
import sys
from pathlib import Path
subprocess.run(['node',str(Path(__file__).parent/'dashboard/build.ts'),sys.argv[1]],check=True)
