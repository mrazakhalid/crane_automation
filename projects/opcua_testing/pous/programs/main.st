PROGRAM main
VAR
	run : bool AT %QX0.0;
	reset : bool AT %QX0.1;
	target : int AT %QW1 := 10;
	cycle_count : int AT %QW0;
	running : bool AT %QX0.2;
	done : bool AT %QX0.3;
	blink : TON;
	pulse : R_TRIG;
	ctr : CTU;
END_VAR

blink(IN := run AND NOT blink.Q, PT := T#1S);
pulse(CLK := blink.Q);
ctr(CU := pulse.Q, R := reset, PV := target);
cycle_count := ctr.CV;
running := run;
done := ctr.Q;

END_PROGRAM