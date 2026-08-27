// Minimal native Windows service fixture for the Shadow Mind real-model
// smoke. Compiled at test time with the .NET Framework csc compiler and
// registered as a uniquely named service; it reports RUNNING to the SCM,
// stays running, and stops cleanly on SERVICE_CONTROL_STOP. It touches
// nothing beyond its own service status.
using System;
using System.Runtime.InteropServices;
using System.Threading;

namespace DshShadowGate
{
    public static class FixtureService
    {
        public const string ServiceName = "DSH_FIXTURE_SERVICE_NAME";

        public enum ServiceState : uint { Stopped = 1, StartPending = 2, StopPending = 3, Running = 4 }

        [StructLayout(LayoutKind.Sequential)]
        public struct ServiceStatus
        {
            public uint dwServiceType;
            public ServiceState dwCurrentState;
            public uint dwControlsAccepted;
            public uint dwWin32ExitCode;
            public uint dwServiceSpecificExitCode;
            public uint dwCheckPoint;
            public uint dwWaitHint;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct ServiceTableEntry
        {
            public IntPtr lpServiceName;
            public IntPtr lpServiceProc;
        }

        public delegate void ServiceMainDelegate(int argc, IntPtr argv);
        public delegate void ServiceControlHandler(uint control);

        [DllImport("advapi32.dll", SetLastError = true)]
        public static extern IntPtr RegisterServiceCtrlHandler(string name, ServiceControlHandler handler);

        [DllImport("advapi32.dll", SetLastError = true)]
        public static extern bool SetServiceStatus(IntPtr handle, ref ServiceStatus status);

        [DllImport("advapi32.dll", SetLastError = true)]
        public static extern bool StartServiceCtrlDispatcher(IntPtr serviceTable);

        public static ServiceStatus status;
        public static IntPtr handle;
        public static ServiceControlHandler handler;

        public static void Handler(uint control)
        {
            if (control == 1) // SERVICE_CONTROL_STOP
            {
                status.dwCurrentState = ServiceState.Stopped;
                SetServiceStatus(handle, ref status);
                Environment.Exit(0);
                return;
            }
            SetServiceStatus(handle, ref status);
        }

        public static void ServiceMain(int argc, IntPtr argv)
        {
            handler = new ServiceControlHandler(Handler);
            handle = RegisterServiceCtrlHandler(ServiceName, handler);
            status.dwServiceType = 0x10; // SERVICE_WIN32_OWN_PROCESS
            status.dwCurrentState = ServiceState.StartPending;
            status.dwControlsAccepted = 0; // controls arrive once RUNNING
            status.dwWaitHint = 10000;
            SetServiceStatus(handle, ref status);
            Thread.Sleep(100);
            status.dwCurrentState = ServiceState.Running;
            status.dwControlsAccepted = 1; // SERVICE_ACCEPT_STOP
            SetServiceStatus(handle, ref status);
            while (true) Thread.Sleep(1000);
        }

        public static int Main(string[] args)
        {
            ServiceMainDelegate main = new ServiceMainDelegate(ServiceMain);
            ServiceTableEntry[] table = new ServiceTableEntry[2];
            table[0].lpServiceName = Marshal.StringToHGlobalUni(ServiceName);
            table[0].lpServiceProc = Marshal.GetFunctionPointerForDelegate(main);
            table[1] = new ServiceTableEntry();
            IntPtr ptr = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(ServiceTableEntry)) * 2);
            Marshal.StructureToPtr(table[0], ptr, false);
            Marshal.StructureToPtr(table[1], IntPtr.Add(ptr, Marshal.SizeOf(typeof(ServiceTableEntry))), false);
            StartServiceCtrlDispatcher(ptr);
            return 0;
        }
    }
}
