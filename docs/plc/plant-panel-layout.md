# Plant PLC / Crane / Tag layout (from Panel_Drawings_081426.xlsx)

Extracted 2026-08-14 from the panel drawings. **PLC -> crane(s) -> I/O tags** is the physical hierarchy; a plant *line* groups cranes but may span **more than one PLC** (Line 4 = PLC_4 cranes 6+7A **and** PLC_6 crane 7B).

| PLC / Panel | Plant line | Cranes | CPU | IP(s) |
|---|---|---|---|---|
| PLC_1 (Panel_1) | Line 1 | 1A, 1B | 6ES7511-1AK02 | TBD |
| PLC_2 (Panel_2) | Line 2 | 2, 3 | 6ES7511-1AK02 | TBD |
| PLC_3 (Panel_3) | Line 3 | 4, 5 | 6ES7511-1AK02 | 192.168.0.113 / .213 |
| PLC_4 (Panel_4) | Line 4 | 6, 7A | 6ES7511-1AK02 | 192.168.0.114 / .214 |
| PLC_5 (Panel_5) | Line 5 | 8, 9 | 6ES7511-1AK02 | TBD |
| PLC_6 (Panel_6) | Line 4 | 7B | 6ES7511-1AK02 | 192.168.0.116 / .216 |

_Each PLC exposes two NICs (`.11X` and `.21X`, /24); the OPC-UA server binds one — confirm which per PLC. Panels 1/2/5 IPs are TBD._

### PLC_1 - Crane 1A  (35 tags)
Tags (address = description): I0.0=E-Stop_SW_C1A; Q0.0=E-Stop_Ind_C1A; I0.1=Auto_SW_C1A; Q0.1=Manual_Ind_C1A; I0.2=Man_SW_C1A; Q0.2=Auto_Ind_C1A; I0.3=LS_Mid_C1A; Q0.3=Parking_Ind_C1A; I0.4=LS_Up_C1A; Q0.4=R-Up_C1A; I0.5=LS_Down_C1A; Q0.5=R-Down_C1A; I0.6=West_Pendant_C1A; Q0.6=R-East_C1A; I0.7=East_Pendant_C1A; Q0.7=R-West_C1A; I1.0=UP_Pendant_C1A; Q1.0=R-Hoist_C1A; I1.1=Down_Pendant_C1A; Q1.1=R-Trolley_C1A; I1.2=LOAD-1A_C1A; I1.3=LOAD-1B_C1A; I1.4=LOAD-1C_C1A; I1.5=LOAD-1D_C1A; I1.6=2-1A_C1A; I1.7=2-1B_C1A; I2.0=2-2_C1A; I2.1=INS-1A_C1A; I2.2=2-3_C1A; I2.3=2-4A_C1A; I2.4=2-4B_C1A; I2.5=2-5_C1A; I2.6=PRK-1B_C1A; I2.7=14-3_C1A; I3.0=TRVL-1A_C1A

### PLC_1 - Crane 1B  (25 tags)
Tags (address = description): I4.0=E-Stop_SW_C1B; I4.1=Auto_SW_C1B; I4.2=Man_SW_C1B; I4.3=LS_Mid_C1B; I4.4=LS_Up_C1B; I4.5=LS_Down_C1B; I4.6=West_Pendant_C1B; I4.7=East_Pendant_C1B; I5.0=UP_Pendant_C1B; I5.1=Down_Pendant_C1B; Q1.2=E-Stop_Ind_C1B; I5.2=PRK-1A_C1B; Q1.3=Manual_Ind_C1B; I5.3=7-1_C1B; Q1.4=Auto_Ind_C1B; I5.4=7-2_C1B; Q1.5=Parking_Ind_C1B; I5.5=14-2_C1B; Q1.6=R-Up_C1B; I5.6=14-1_C1B; Q1.7=R-Down_C1B; Q2.0=R-East_C1B; Q2.1=R-West_C1B; Q2.2=R-Hoist_C1B; Q2.3=R-Trolley_C1B

### PLC_2 - Crane 2  (27 tags)
Tags (address = description): I4.0=E-Stop_SW_C2; I4.1=Auto_SW_C2; I4.2=Man_SW_C2; I4.3=LS_Mid_C2; I4.4=LS_Up_C2; I4.5=LS_Down_C2; I4.6=West_Pendant_C2; I4.7=East_Pendant_C2; I5.0=UP_Pendant_C2; I5.1=Down_Pendant_C2; Q1.2=E-Stop_Ind_C2; I5.2=PRK-2A_C2; Q1.3=Manual_Ind_C2; I5.3=15-3_C2; Q1.4=Auto_Ind_C2; I5.4=4-7_C2; Q1.5=Parking_Ind_C2; I5.5=4-9_C2; Q1.6=R-Up_C2; I5.6=INS-2A_C2; Q1.7=R-Down_C2; I5.7=4-10_C2; Q2.0=R-East_C2; I6.0=4-6A_C2; Q2.1=R-West_C2; Q2.2=R-Hoist_C2; Q2.3=R-Trolley_C2

### PLC_2 - Crane 3  (36 tags)
Tags (address = description): I0.0=E-Stop_SW_C3; Q0.0=E-Stop_Ind_C3; I0.1=Auto_SW_C3; Q0.1=Manual_Ind_C3; I0.2=Man_SW_C3; Q0.2=Auto_Ind_C3; I0.3=LS_Mid_C3; Q0.3=Parking_Ind_C3; I0.4=LS_Up_C3; Q0.4=R-Up_C3; I0.5=LS_Down_C3; Q0.5=R-Down_C3; I0.6=West_Pendant_C3; Q0.6=R-East_C3; I0.7=East_Pendant_C3; Q0.7=R-West_C3; I1.0=UP_Pendant_C3; Q1.0=R-Hoist_C3; I1.1=Down_Pendant_C3; Q1.1=R-Trolley_C3; I1.2=LOAD-2A_C3; I1.3=LOAD-2B_C3; I1.4=LOAD-2C_C3; I1.5=LOAD-2D_C3; I1.6=DRY-2A_C3; I1.7=4-8_C3; I2.0=4-1_C3; I2.1=4-2_C3; I2.2=4-3_C3; I2.3=4-4_C3; I2.4=4-5_C3; I2.5=INS-2B_C3; I2.6=4-11_C3; I2.7=PRK-2B_C3; I3.0=4-6B_C3; I3.1=TRVL-2A_C3

### PLC_3 - Crane 4  (29 tags)
Tags (address = description): I0.0=E-Stop_SW_C4; Q0.0=E-Stop_Ind_C4; I0.1=Auto_SW_C4; Q0.1=Manual_Ind_C4; I0.2=Man_SW_C4; Q0.2=Auto_Ind_C4; I0.3=LS_Mid_C4; Q0.3=Parking_Ind_C4; I0.4=LS_Up_C4; Q0.4=R-Up_C4; I0.5=LS_Down_C4; Q0.5=R-Down_C4; Q0.6=R-East_C4; I0.7=1-16_C4; Q0.7=R-West_C4; I1.0=1-15_C4; Q1.0=R-Hoist_C4; I1.1=1-14_C4; Q1.1=R-Trolley_C4; I1.2=1-13_C4; I1.3=1-12B_C4; I1.4=1-12A_C4; I1.5=TRVL-3A_C4; I1.6=15-2_C4; I2.0=West_Pendant_C4; I2.1=East_Pendant_C4; I2.2=UP_Pendant_C4; I2.3=Down_Pendant_C4; I2.4=Fast_Pendent_C4

### PLC_3 - Crane 5  (33 tags)
Tags (address = description): I4.0=E-Stop_SW_C5; I4.1=Auto_SW_C5; I4.2=Man_SW_C5; I4.3=LS_Mid_C5; I4.4=LS_Up_C5; I4.5=LS_Down_C5; I4.6=LOAD-3A_C5; I4.7=DRY-3A_C5; I5.0=3-4A_C5; I5.1=INS-3A_C5; I5.2=6-2_C5; I5.3=6-1_C5; I5.4=3-3_C5; I5.5=3-2_C5; I5.6=3-1B_C5; I5.7=PRK-3B_C5; Q2.0=E-Stop_Ind_C5; I6.0=3-1A_C5; Q2.1=Manual_Ind_C5; I6.1=West_Pendant_C5; Q2.2=Auto_Ind_C5; I6.2=East_Pendant_C5; Q2.3=Parking_Ind_C5; I6.3=UP_Pendant_C5; Q2.4=R-Up_C5; I6.4=Down_Pendant_C5; Q2.5=R-Down_C5; Q2.6=R-East_C5; Q2.7=R-West_C5; Q3.0=R-Hoist_C5; I7.0=TRVL-3B_C5; Q3.1=R-Trolley_C5; I7.1=Fast_Pendent_C5

### PLC_4 - Crane 6  (26 tags)
Tags (address = description): I0.0=E-Stop_SW_C6; Q0.0=E-Stop_Ind_C6; I0.1=Auto_SW_C6; Q0.1=Manual_Ind_C6; I0.2=Man_SW_C6; Q0.2=Auto_Ind_C6; I0.3=LS_Mid_C6; Q0.3=Parking_Ind_C6; I0.4=LS_Up_C6; Q0.4=R-Up-1_C6; I0.5=LS_Down_C6; Q0.5=R-Down-1_C6; Q0.6=R-East-1_C6; I0.7=PRK-4A_C6; Q0.7=R-West-1_C6; I1.0=1-7B_C6; I1.1=1-8_C6; I1.2=1-9_C6; I1.3=1-10A_C6; I1.4=1-10B_C6; I1.5=1-11_C6; I1.6=TRVL-4A_C6; I1.7=West_Pendant_C6; I2.0=East_Pendant_C6; I2.1=UP_Pendant_C6; I2.2=Down_Pendant_C6

### PLC_4 - Crane 7A  (21 tags)
Tags (address = description): I4.0=E-Stop_SW_C7A; I4.1=Auto_SW_C7A; I4.2=Man_SW_C7A; I4.3=LS_Mid_C7A; I4.4=LS_Up_C7A; I4.5=LS_Down_C7A; I5.7=West_Pendant_C7A; Q2.0=E-Stop_Ind_C7A; I6.0=East_Pendant_C7A; Q2.1=Manual_Ind_C7A; I6.1=UP_Pendant_C7A; Q2.2=Auto_Ind_C7A; I6.2=Down_Pendant_C7A; Q2.3=Parking_Ind_C7A; I6.3=LOAD-4B_C7A; Q2.4=R-Up-1_C7A; I6.4=LOAD-4C_C7A; Q2.5=R-Down-1_C7A; I6.5=LOAD-4D_C7A; Q2.6=R-East-1_C7A; Q2.7=R-West-1_C7A

### PLC_5 - Crane 8  (29 tags)
Tags (address = description): I4.0=E-Stop_SW_C8; I4.1=Auto_SW_C8; I4.2=Man_SW_C8; I4.3=LS_Mid_C8; I4.4=LS_Up_C8; I4.5=LS_Down_C8; I4.6=West_Pendant_C8; I4.7=East_Pendant_C8; I5.0=UP_Pendant_C8; I5.1=Down_Pendant_C8; Q1.2=E-Stop_Ind_C8; I5.2=PRK-5A_C8; Q1.3=Manual_Ind_C8; I5.3=5-2_C8; Q1.4=Auto_Ind_C8; I5.4=INS-5A_C8; Q1.5=Parking_Ind_C8; I5.5=5-3_C8; Q1.6=R-Up_C8; I5.6=INS-5B_C8; Q1.7=R-Down_C8; I5.7=5-1_C8; Q2.0=R-East_C8; I6.0=INS-5C_C8; Q2.1=R-West_C8; I6.1=5-4_C8; Q2.2=R-Hoist_C8; I6.2=5-5_C8; Q2.3=R-Trolley_C8

### PLC_5 - Crane 9  (36 tags)
Tags (address = description): I0.0=E-Stop_SW_C9; Q0.0=E-Stop_Ind_C9; I0.1=Auto_SW_C9; Q0.1=Manual_Ind_C9; I0.2=Man_SW_C9; Q0.2=Auto_Ind_C9; I0.3=LS_Mid_C9; Q0.3=Parking_Ind_C9; I0.4=LS_Up_C9; Q0.4=R-Up_C9; I0.5=LS_Down_C9; Q0.5=R-Down_C9; I0.6=West_Pendant_C9; Q0.6=R-East_C9; I0.7=East_Pendant_C9; Q0.7=R-West_C9; I1.0=UP_Pendant_C9; Q1.0=R-Hoist_C9; I1.1=Down_Pendant_C9; Q1.1=R-Trolley_C9; I1.2=LOAD-5A_C9; I1.3=LOAD-5B_C9; I1.4=LOAD-5C_C9; I1.5=LOAD-5D_C9; I1.6=DRY-5A_C9; I1.7=5-12_C9; I2.0=INS-5E_C9; I2.1=5-11_C9; I2.2=5-10_C9; I2.3=5-9_C9; I2.4=INS-5D_C9; I2.5=5-8_C9; I2.6=5-7_C9; I2.7=PRK-5B_C9; I3.0=5-6_C9; I3.1=TRVL-5A_C9

### PLC_6 - Crane 7B  (20 tags)
Tags (address = description): I0.0=E-Stop_SW_C7B; Q0.0=E-Stop_Ind_C7B; I0.1=Auto_SW_C7B; Q0.1=Manual_Ind_C7B; I0.2=Man_SW_C7B; Q0.2=Auto_Ind_C7B; I0.3=LS_Mid_C7B; Q0.3=Parking_Ind_C7B; I0.4=LS_Up_C7B; Q0.4=R-Up-1_C7B; I0.5=LS_Down_C7B; Q0.5=R-Down-1_C7B; Q0.6=R-East-1_C7B; Q0.7=R-West-1_C7B; Q1.0=R-Hoist-1_C7B; Q1.1=R-Trolley-1_C7B; I1.7=West_Pendant_C7B; I2.0=East_Pendant_C7B; I2.1=UP_Pendant_C7B; I2.2=Down_Pendant_C7B
